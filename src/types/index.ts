export interface Room {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  price: number;
  image: string;
  gallery: string[];
  capacity: number;
  size: string;
  features: string[];
}

export interface Amenity {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  rating: number;
  quote: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
  span: "tall" | "wide" | "normal";
}
