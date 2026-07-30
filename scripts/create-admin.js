import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email, password, role = 'admin', fullName = 'Admin User'] = process.argv.slice(2);

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

if (!email) {
  console.error('Usage: node scripts/create-admin.js <email> [password] [role] [fullName]');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  const passwordValue = password || 'ChangeMe123!';
  console.log(`Creating Supabase user for ${email}...`);

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: passwordValue,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (userError) {
    console.error('Failed to create Supabase user:', userError.message || userError);
    process.exit(1);
  }

  const userId = userData?.user?.id;
  if (!userId) {
    console.error('Could not read created user ID from Supabase response.');
    process.exit(1);
  }

  console.log(`Created user ID ${userId}. Assigning role '${role}'...`);
  const { error: roleError } = await supabase.from('user_roles').insert({
    user_id: userId,
    role,
    is_approved: ['admin', 'attendant', 'merchant'].includes(role),
  });

  if (roleError) {
    console.error('Failed to insert user_roles row:', roleError.message || roleError);
    process.exit(1);
  }

  console.log(`Admin user created successfully:
  email: ${email}
  password: ${passwordValue}
  role: ${role}
`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
