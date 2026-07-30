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

export interface Order {
  id: string;
  contact_name: string;
  phone: string;
  delivery_address: string;
  market_location?: string;
  user_id?: string | null;
  items: OrderItem[];
  subtotal: number;
  delivery_fee?: number;
  status: string;
  created_at: string;
}
