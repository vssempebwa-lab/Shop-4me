import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowFreeAdminAccess = process.env.SFM_ALLOW_FREE_ADMIN_ACCESS === 'true';
const freeAdminHeader = 'local-free-access';
const officialOutletCodes = new Set([
  'DEPOT-KAW-01',
  'DEPOT-NAK-02',
  'DEPOT-CEN-03',
  'DEPOT-MAK-04',
  'DEPOT-RUB-05',
]);
const ugandaPhonePattern = /^(\+256(7\d{8}|20\d{7}|39\d{7})|0(7\d{8}|20\d{7}|39\d{7}))$/;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function getBearerToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
}

function normalizeUgandaPhoneNumber(value) {
  return String(value || '').replace(/[\s()-]/g, '').trim();
}

function validateUgandaPhoneNumber(value) {
  const normalized = normalizeUgandaPhoneNumber(value);
  if (!normalized) return { message: 'Phone number is required.' };
  if (!ugandaPhonePattern.test(normalized)) {
    return { message: 'Enter a valid Uganda phone number, e.g. 0772 123 456 or +256 772 123 456.' };
  }
  return { phoneNumber: normalized };
}

async function requireAdmin(event, supabaseAdmin) {
  const freeAccessHeader = event.headers['x-sfm-free-admin'] || event.headers['X-SFM-Free-Admin'];
  if (allowFreeAdminAccess && freeAccessHeader === freeAdminHeader) {
    return { user: { id: 'local-free-access' } };
  }

  const token = getBearerToken(event);
  if (!token) return { error: json(401, { message: 'Missing auth token.' }) };

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return { error: json(401, { message: 'Invalid auth token.' }) };

  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role,is_approved,is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (
    roleError ||
    !roleData ||
    roleData.is_active === false ||
    roleData.is_approved === false ||
    !['admin', 'merchant'].includes(roleData.role)
  ) {
    return { error: json(403, { message: 'Only admins can manage admin accounts.' }) };
  }

  return { user };
}

async function createAccount(event, supabaseAdmin, actorId) {
  const body = JSON.parse(event.body || '{}');
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '').trim();
  const fullName = String(body.fullName || '').trim();
  const phoneValidation = validateUgandaPhoneNumber(body.phoneNumber);
  const avatarUrl = String(body.avatarUrl || '').trim() || null;
  const role = body.role === 'attendant' ? 'attendant' : 'admin';
  const assignedOutlet = role === 'attendant' ? String(body.assignedOutlet || '').trim() : null;

  if (!email.includes('@')) {
    return json(400, { message: 'Enter a valid email address.' });
  }

  if (!password || password.length < 8) {
    return json(400, { message: 'Password must be at least 8 characters.' });
  }

  if (phoneValidation.message) {
    return json(400, { message: phoneValidation.message });
  }

  if (role === 'attendant' && !assignedOutlet) {
    return json(400, { message: 'Assign an outlet for attendant accounts.' });
  }

  if (role === 'attendant') {
    const { data: outlet, error: outletError } = await supabaseAdmin
      .from('outlets')
      .select('outlet_code')
      .eq('outlet_code', assignedOutlet)
      .eq('is_active', true)
      .maybeSingle();

    if ((outletError || !outlet) && !officialOutletCodes.has(assignedOutlet)) {
      return json(400, { message: 'Assigned outlet must be one of the active official SFM outlets.' });
    }
  }

  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone_number: phoneValidation.phoneNumber },
  });

  if (createError || !userData?.user) {
    return json(400, { message: createError?.message || 'Could not create account.' });
  }

  const { error: roleError } = await supabaseAdmin.from('user_roles').upsert(
    {
      user_id: userData.user.id,
      email,
      full_name: fullName || null,
      phone_number: phoneValidation.phoneNumber,
      avatar_url: avatarUrl,
      role,
      assigned_outlet: assignedOutlet,
      is_approved: true,
      is_active: true,
      invited_by: actorId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (roleError) {
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    return json(400, { message: roleError.message || 'Could not assign role.' });
  }

  await supabaseAdmin.from('admin_audit_logs').insert({
    actor_user_id: actorId,
    action: 'account_created',
    target_type: 'user_role',
    target_id: userData.user.id,
    metadata: { email, role, assigned_outlet: assignedOutlet, phone_number: phoneValidation.phoneNumber },
  });

  return json(201, { userId: userData.user.id, email, role, assignedOutlet });
}

async function deactivateAccount(event, supabaseAdmin, actorId) {
  const body = JSON.parse(event.body || '{}');
  const userId = String(body.userId || '').trim();

  if (!userId) return json(400, { message: 'Missing userId.' });
  if (userId === actorId) return json(400, { message: 'You cannot deactivate your own access.' });

  const { data: targetRole, error: targetError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (targetError || !targetRole) {
    return json(404, { message: 'Account not found.' });
  }

  if (['admin', 'merchant'].includes(targetRole.role)) {
    const { count, error: countError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .in('role', ['admin', 'merchant'])
      .eq('is_active', true)
      .eq('is_approved', true)
      .neq('user_id', userId);

    if (countError) return json(400, { message: countError.message });
    if ((count ?? 0) === 0) {
      return json(400, { message: 'At least one active admin must remain.' });
    }
  }

  const { error } = await supabaseAdmin
    .from('user_roles')
    .update({
      is_active: false,
      is_approved: false,
      deactivated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) return json(400, { message: error.message || 'Could not deactivate account.' });

  await supabaseAdmin.from('admin_audit_logs').insert({
    actor_user_id: actorId,
    action: 'account_deactivated',
    target_type: 'user_role',
    target_id: userId,
  });

  return json(200, { ok: true });
}

async function activateAccount(event, supabaseAdmin, actorId) {
  const body = JSON.parse(event.body || '{}');
  const userId = String(body.userId || '').trim();

  if (!userId) return json(400, { message: 'Missing userId.' });
  if (userId === actorId) return json(400, { message: 'Your account is already active.' });

  const { data: targetRole, error: targetError } = await supabaseAdmin
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (targetError || !targetRole) {
    return json(404, { message: 'Account not found.' });
  }

  if (targetRole.is_active !== false) {
    return json(200, { ok: true, message: 'Account is already active.' });
  }

  const { error } = await supabaseAdmin
    .from('user_roles')
    .update({
      is_active: true,
      is_approved: true,
      deactivated_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) return json(400, { message: error.message || 'Could not activate account.' });

  await supabaseAdmin.from('admin_audit_logs').insert({
    actor_user_id: actorId,
    action: 'account_activated',
    target_type: 'user_role',
    target_id: userId,
  });

  return json(200, { ok: true });
}

async function resetPassword(event, supabaseAdmin, actorId) {
  const body = JSON.parse(event.body || '{}');
  const userId = String(body.userId || '').trim();
  const password = String(body.password || '').trim();

  if (!userId) return json(400, { message: 'Missing userId.' });
  if (!password || password.length < 8) {
    return json(400, { message: 'Password must be at least 8 characters.' });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) return json(400, { message: error.message || 'Could not reset password.' });

  await supabaseAdmin.from('admin_audit_logs').insert({
    actor_user_id: actorId,
    action: 'account_password_reset',
    target_type: 'user_role',
    target_id: userId,
  });

  return json(200, { ok: true });
}

async function updateAccount(event, supabaseAdmin, actorId) {
  const body = JSON.parse(event.body || '{}');
  const userId = String(body.userId || '').trim();
  const fullName = String(body.fullName || '').trim();
  const phoneValidation = validateUgandaPhoneNumber(body.phoneNumber);
  const avatarUrl = body.avatarUrl === null ? null : String(body.avatarUrl || '').trim() || undefined;
  const role = body.role === 'attendant' ? 'attendant' : 'admin';
  const assignedOutlet = role === 'attendant' ? String(body.assignedOutlet || '').trim() : null;

  if (!userId) return json(400, { message: 'Missing userId.' });
  if (!fullName) return json(400, { message: 'Full name is required.' });
  if (phoneValidation.message) {
    return json(400, { message: phoneValidation.message });
  }
  if (role === 'attendant' && !assignedOutlet) {
    return json(400, { message: 'Assign an outlet for attendant accounts.' });
  }

  if (role === 'attendant') {
    const { data: outlet, error: outletError } = await supabaseAdmin
      .from('outlets')
      .select('outlet_code')
      .eq('outlet_code', assignedOutlet)
      .eq('is_active', true)
      .maybeSingle();

    if ((outletError || !outlet) && !officialOutletCodes.has(assignedOutlet)) {
      return json(400, { message: 'Assigned outlet must be one of the active official SFM outlets.' });
    }
  }

  const updatePayload = {
    full_name: fullName,
    phone_number: phoneValidation.phoneNumber,
    role,
    assigned_outlet: assignedOutlet,
    updated_at: new Date().toISOString(),
  };

  if (avatarUrl !== undefined) {
    updatePayload.avatar_url = avatarUrl;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('user_roles')
    .update(updatePayload)
    .eq('user_id', userId)
    .select('id,user_id,email,full_name,phone_number,avatar_url,role,assigned_outlet,is_approved,is_active,invited_by,last_login_at,created_at,deactivated_at')
    .maybeSingle();

  if (error) return json(400, { message: error.message || 'Could not update account.' });
  if (!updated) return json(404, { message: 'Account not found.' });

  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { full_name: fullName, phone_number: phoneValidation.phoneNumber },
  });

  await supabaseAdmin.from('admin_audit_logs').insert({
    actor_user_id: actorId,
    action: 'account_updated',
    target_type: 'user_role',
    target_id: userId,
    metadata: {
      full_name: fullName,
      phone_number: phoneValidation.phoneNumber,
      role,
      assigned_outlet: assignedOutlet,
      avatar_updated: avatarUrl !== undefined,
    },
  });

  return json(200, { user: updated });
}

export async function handler(event) {
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { message: 'Supabase server configuration is missing.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const adminCheck = await requireAdmin(event, supabaseAdmin);
  if (adminCheck.error) return adminCheck.error;

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('id,user_id,email,full_name,phone_number,avatar_url,role,assigned_outlet,is_approved,is_active,invited_by,last_login_at,created_at,deactivated_at')
      .in('role', ['admin', 'attendant', 'merchant'])
      .order('created_at', { ascending: false });

    if (error) return json(400, { message: error.message });
    return json(200, { users: data ?? [] });
  }

  if (event.httpMethod === 'POST') {
    return createAccount(event, supabaseAdmin, adminCheck.user.id);
  }

  if (event.httpMethod === 'PATCH') {
    const body = JSON.parse(event.body || '{}');
    if (body.action === 'update_account') {
      return updateAccount(event, supabaseAdmin, adminCheck.user.id);
    }
    if (body.action === 'reset_password') {
      return resetPassword(event, supabaseAdmin, adminCheck.user.id);
    }
    if (body.action === 'activate') {
      return activateAccount(event, supabaseAdmin, adminCheck.user.id);
    }
    return deactivateAccount(event, supabaseAdmin, adminCheck.user.id);
  }

  return json(405, { message: 'Method not allowed.' });
}
