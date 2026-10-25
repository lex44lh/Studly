"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import ServiceCard from "@/components/ServiceCard";
import { useDemoCatalog } from "@/features/demo-workspace/catalog";
import { demoMode } from "@/lib/api/catalog";
import ServiceList from "@/components/catalog/ServiceList";
import { Icon, type IconName } from "@/components/studly/Icon";

export default function HomePage() {
  const services = useDemoCatalog();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const categories: { slug: string; title: string; icon: IconName }[] = [
    { slug: "homework", title: "Помощь с заданиями", icon: "book" },
    { slug: "tutoring", title: "Репетиторство", icon: "user" },
    { slug: "programming", title: "Программирование", icon: "code" },
    { slug: "video", title: "Видеомонтаж", icon: "video" },
  ];
  const popularServices = services.slice(0, 4);
  const handleSearch = () => {
    const query = searchQuery.trim();
    if (!query) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };
  return <div className="campus-page">
    <section className="page-panel home-hero">
      <div><header className="page-heading"><div><p className="page-eyebrow">СВОИ ЛЮДИ. НУЖНЫЕ НАВЫКИ.</p><h1>Твоя задача.<br /><span>Чья-то сильная сторона.</span></h1><p className="page-intro">От учёбы до творчества — найди нужную помощь в своём кампусе.</p></div></header>
        <form className="home-search" role="search" onSubmit={event => { event.preventDefault(); handleSearch(); }}>
          <Icon name="search" /><label className="sr-only" htmlFor="home-search">Поиск услуг</label>
          <input id="home-search" type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="С чем нужна помощь?" />
          <button type="submit" className="page-button" aria-label="Найти"><span>Найти</span><Icon name="arrow" /></button>
        </form>
      </div><div className="home-ribbon" aria-hidden="true"><BrandMark size={120} /></div>
    </section>
    <section className="page-section" aria-labelledby="home-categories"><div className="page-section-title"><h2 id="home-categories">Популярные категории</h2></div>
      <div className="home-categories">{categories.map(category => <Link key={category.slug} href={`/category/${category.slug}`} className="home-category"><Icon name={category.icon} /><span>{category.title}</span><Icon name="arrow" /></Link>)}</div>
    </section>
    <section className="page-section" aria-labelledby="home-services"><div className="page-section-title"><h2 id="home-services">{demoMode ? "Популярные услуги" : "Услуги"}</h2><Link href="/search">Весь каталог <Icon name="arrow" /></Link></div>
      {demoMode ? <div className="page-grid">{popularServices.map(service => <ServiceCard key={service.id} {...service} isDemo />)}</div> : <ServiceList limit={4} />}
    </section>
    <div className="page-actions page-section"><Link href="/search" className="page-button">Смотреть все услуги <Icon name="arrow" /></Link></div>
  </div>;
}
