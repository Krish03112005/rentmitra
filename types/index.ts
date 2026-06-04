export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  images: [string, ...string[]];
  is_featured: boolean;
  is_sold: boolean;
  owner_clerk_id?: string | null;
  contact_whatsapp?: string | null;
  created_at: string;
}
