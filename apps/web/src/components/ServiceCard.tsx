"use client";

import { CampusServiceCard } from "./studly/CampusServiceCard";

type Props = {
  id: number; title: string; price: string; seller: string; rating?: string; isDemo?: boolean;
  category?: string; description?: string; duration?: string; profileId?: number;
};

export default function ServiceCard(props: Props) {
  return <CampusServiceCard {...props} />;
}
