export type Category =
  | 'Food Sauce'
  | 'Fruits'
  | 'Spices'
  | 'Kitchen Ware'
  | 'Cooking Fuels'
  | 'And More';

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  unit: string;
  image_url: string | null;
  description: string | null;
  in_stock: boolean;
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  created_at?: string;
}

export type FinalBillLineStatus = 'bought' | 'substituted' | 'unavailable';

export interface FinalBillItem {
  product_id: string;
  name: string;
  unit: string;
  quantity: number;
  /** Catalogue unit price the customer saw at checkout. */
  estimated_unit_price: number;
  status: FinalBillLineStatus;
  /** What the attendant actually paid for the whole line, in UGX. */
  actual_line_total: number;
  substitute_name?: string | null;
  note?: string | null;
}

export type BillStatus = 'not_started' | 'awaiting_approval' | 'approved' | 'queried';
export type BillApprovalMethod = 'customer_app' | 'phone_call' | 'auto_within_estimate';

export interface Order {
  id: string;
  contact_name: string;
  phone: string;
  delivery_address: string;
  market_location?: string;
  user_id?: string | null;
  items: OrderItem[];
  subtotal: number;
  total_amount?: number | null;
  delivery_fee?: number;
  payment_method?: string | null;
  status: string;
  order_status?: 'Order Received' | 'Pending' | 'Processing' | 'Transit' | 'Delivered' | 'Cancelled';
  payment_status?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  is_shared_with_outlet?: boolean;
  outlet_code?: string | null;
  division?: string | null;
  shared_at?: string | null;
  shared_by?: string | null;
  shared_by_admin_id?: string | null;
  shared_by_admin_name?: string | null;
  manual_outlet_override?: boolean | null;
  suggested_outlet_code?: string | null;
  dispatched_rider_id?: string | null;
  dispatched_rider_name?: string | null;
  dispatched_at?: string | null;
  handled_by_attendant_id?: string | null;
  handled_by_attendant_name?: string | null;
  delivered_at?: string | null;
  final_items?: FinalBillItem[] | null;
  final_subtotal?: number | null;
  final_total?: number | null;
  bill_status?: BillStatus | null;
  bill_submitted_at?: string | null;
  bill_submitted_by_name?: string | null;
  bill_responded_at?: string | null;
  bill_approval_method?: BillApprovalMethod | null;
  bill_customer_note?: string | null;
  /** Public URLs of photos of the goods / market receipt. */
  bill_photos?: string[] | null;
  created_at: string;
}

export interface Outlet {
  outlet_code: string;
  name: string;
  division: string;
  hub_market?: string | null;
  distribution_areas: string[];
  phone?: string | null;
  is_active: boolean;
}

export interface OutletRider {
  id: string;
  outlet_code: string;
  name: string;
  phone: string;
  is_active: boolean;
}

export interface UserRoleProfile {
  id?: string;
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
  role: 'admin' | 'attendant' | 'merchant' | 'customer';
  assigned_outlet?: string | null;
  is_approved?: boolean;
  is_active?: boolean;
  invited_by?: string | null;
  last_login_at?: string | null;
  created_at?: string;
  deactivated_at?: string | null;
}

export interface AdminAuditLog {
  id: string;
  actor_user_id?: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
