"use client";
import { useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import { CreateServiceRoute } from "@/features/demo-workspace/Routing";

import { useState } from "react";
import { Icon } from "@/components/studly/Icon";
import styles from "./create-service.module.css";

export default function CreateServicePage() {
  const workspace = useOptionalDemoWorkspace();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");
  const [included, setIncluded] = useState("");
  const [extras, setExtras] = useState([
  {
    name: "",
    price: "",
  },
    ]);
const [imagePreview, setImagePreview] = useState("");
const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] =
  useState(false);

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (!category) {
      newErrors.category = "Выберите категорию";
    }

    if (!title.trim()) {
      newErrors.title = "Введите название услуги";
    }

    if (!description.trim()) {
      newErrors.description = "Введите описание";
    }

    if (!price.trim()) {
        newErrors.price = "Укажите цену";
    }

    const priceNumber = Number(price);

    if (price && priceNumber < 10) {
        newErrors.price = "Минимальная цена — 10 ₽";
    }

    if (price && priceNumber > 1000000) {
        newErrors.price = "Максимальная цена — 1 000 000 ₽";
    }

    if (!days.trim()) {
        newErrors.days = "Укажите срок выполнения";
    }

    const daysNumber = Number(days);

    if (days && daysNumber < 1) {
        newErrors.days = "Минимальный срок — 1 день";
    }

    if (days && daysNumber > 365) {
        newErrors.days = "Максимальный срок — 365 дней";
    }

    if (!included.trim()) {
      newErrors.included = "Укажите, что входит в услугу";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      alert("Проверка формы завершена. Это предпросмотр: услуга не отправлена на сервер и не опубликована.");
    }
  };

const addExtraService = () => {
  setExtras([
    ...extras,
    {
      name: "",
      price: "",
    },
  ]);
};

const updateExtra = (
  index: number,
  field: "name" | "price",
  value: string
) => {
  const updated = [...extras];

  updated[index][field] = value;

  setExtras(updated);
};

const removeExtra = (index: number) => {
  setExtras(
    extras.filter((_, i) => i !== index)
  );
};

const handleImageUpload = (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];

  if (!file) return;

  const imageUrl = URL.createObjectURL(file);

  setImagePreview(imageUrl);
  setFileName(file.name);
};
const removeImage = () => {
  setImagePreview("");
  setFileName("");
};

  if (workspace) return <CreateServiceRoute/>;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Личный кабинет / Услуги</p>
        <h1>Создание услуги</h1>
        <p>Расскажите, чем вы можете помочь, и соберите понятное предложение.</p>
      </header>
      <p className={styles.notice} role="note"><Icon name="pen" /><span>Предпросмотр формы. Услуга не отправляется на сервер и не публикуется.</span></p>
      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <section className={styles.panel} aria-labelledby="service-basics-title">
            <div className={styles.sectionHeading}><span>01</span><div><h2 id="service-basics-title">Об услуге</h2><p>Помогите заказчику понять вашу задачу</p></div></div>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label htmlFor="service-category">Категория <span aria-hidden="true">*</span></label>
                <select id="service-category" value={category} onChange={(e) => setCategory(e.target.value)} aria-required="true" aria-invalid={!!errors.category} aria-describedby={errors.category ? "category-error" : undefined}>
                  <option value="">Выберите категорию</option>
                  <option>📚 Помощь с заданиями</option><option>🎓 Помощь с курсовыми</option><option>👨‍🏫 Репетиторство</option><option>💻 Программирование</option><option>📐 Инженерная графика</option><option>📊 Презентации</option><option>📝 Рефераты и отчёты</option><option>🎬 Видеомонтаж</option>
                </select>
                {errors.category && <p id="category-error" className={styles.error} role="alert">{errors.category}</p>}
              </div>
              <div className={styles.field}>
                <label htmlFor="service-title-input">Название услуги <span aria-hidden="true">*</span></label>
                <input id="service-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Помогу с C++" aria-required="true" aria-invalid={!!errors.title} aria-describedby={errors.title ? "title-error" : undefined} />
                {errors.title && <p id="title-error" className={styles.error} role="alert">{errors.title}</p>}
              </div>
              <div className={styles.field}>
                <label htmlFor="service-description">Описание <span aria-hidden="true">*</span></label>
                <textarea id="service-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Опишите Вашу услугу" aria-required="true" aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : undefined} />
                {errors.description && <p id="description-error" className={styles.error} role="alert">{errors.description}</p>}
              </div>
            </div>
          </section>
          <section className={styles.panel} aria-labelledby="service-terms-title">
            <div className={styles.sectionHeading}><span>02</span><div><h2 id="service-terms-title">Стоимость и условия</h2><p>Понятная цена и результат работы</p></div></div>
            <div className={styles.fields}>
              <div className={styles.twoColumns}>
                <div className={styles.field}>
                  <label htmlFor="service-price">Цена, ₽ <span aria-hidden="true">*</span></label>
                  <input id="service-price" type="number" inputMode="decimal" min="10" max="1000000" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="500" aria-required="true" aria-invalid={!!errors.price} aria-describedby={errors.price ? "price-error" : undefined} />
                  {errors.price && <p id="price-error" className={styles.error} role="alert">{errors.price}</p>}
                </div>
                <div className={styles.field}>
                  <label htmlFor="service-days">Срок выполнения, дней <span aria-hidden="true">*</span></label>
                  <input id="service-days" type="number" inputMode="numeric" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} placeholder="3" aria-required="true" aria-invalid={!!errors.days} aria-describedby={errors.days ? "days-error" : undefined} />
                  {errors.days && <p id="days-error" className={styles.error} role="alert">{errors.days}</p>}
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="service-included">Что входит <span aria-hidden="true">*</span></label>
                <textarea id="service-included" value={included} onChange={(e) => setIncluded(e.target.value)} placeholder="Перечислите, что получит заказчик" aria-required="true" aria-invalid={!!errors.included} aria-describedby={errors.included ? "included-error" : undefined} />
                {errors.included && <p id="included-error" className={styles.error} role="alert">{errors.included}</p>}
              </div>
            </div>
          </section>
          <section className={styles.panel} aria-labelledby="service-image-title">
            <div className={styles.sectionHeading}><span>03</span><div><h2 id="service-image-title">Фото услуги</h2><p>Изображение для предпросмотра</p></div></div>
            <div className={styles.upload}>
              <Icon name="grid" />
              <label htmlFor="service-image">Загрузить фото</label>
              <input id="service-image" type="file" accept="image/*" onChange={handleImageUpload} />
            </div>
            {fileName && <p className={styles.fileName}>{fileName}</p>}
            {imagePreview && <div className={styles.imagePreview}>
              <img src={imagePreview} alt="Фото услуги" />
              <button type="button" onClick={removeImage} className={styles.remove}>Удалить фото</button>
            </div>}
          </section>
          <section className={styles.panel} aria-labelledby="service-extras-title">
            <div className={styles.sectionHeading}><span>04</span><div><h2 id="service-extras-title">Дополнительные услуги</h2><p>Параметры, которые можно добавить к услуге</p></div></div>
            <div className={styles.fields}>
              {extras.map((extra, index) => <div key={index} className={styles.extra}>
                <div className={styles.field}>
                  <label htmlFor={`extra-name-${index}`}>Название доп. услуги</label>
                  <input id={`extra-name-${index}`} value={extra.name} onChange={(e) => updateExtra(index, "name", e.target.value)} placeholder="Название доп. услуги" />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`extra-price-${index}`}>Цена, ₽</label>
                  <input id={`extra-price-${index}`} type="number" inputMode="decimal" min="10" value={extra.price} onChange={(e) => updateExtra(index, "price", e.target.value)} placeholder="Цена" />
                </div>
                {extras.length > 1 && <button type="button" onClick={() => removeExtra(index)} className={styles.remove} aria-label={`Удалить дополнительную услугу ${index + 1}`}>Удалить</button>}
              </div>)}
              <button type="button" onClick={addExtraService} className={styles.secondary}>+ Добавить ещё</button>
            </div>
          </section>
        </div>
        <aside className={styles.summary} aria-label="Предпросмотр услуги">
          <div className={styles.panel}>
            <div className={styles.summaryIcon}><Icon name="book" /></div>
            <h2>Взгляд заказчика</h2>
            <p className={styles.hint}>Посмотрите, как собранное предложение будет выглядеть в предпросмотре.</p>
            <div className={styles.actions}>
              <button type="button" onClick={() => setShowPreview(!showPreview)} className={styles.secondary} aria-expanded={showPreview} aria-controls="service-form-preview">Предпросмотреть услугу</button>
              <button type="button" onClick={handleSubmit} className={styles.primary}>Проверить демо-форму</button>
            </div>
            <p className={styles.caption}>Проверка полей не публикует услугу</p>
          </div>
          {showPreview && <section id="service-form-preview" className={styles.preview} aria-label="Предпросмотр введённых данных">
            <div className={styles.previewCover}>{imagePreview ? <img src={imagePreview} alt="Предпросмотр фото услуги" /> : <><Icon name="grid" /><span>Фото услуги</span></>}</div>
            <div className={styles.previewBody}>
              <p className={styles.previewLabel}>Предпросмотр</p>
              <p className={styles.previewPrice}>{price || "0"} ₽</p>
              <h3>{title || "Название услуги"}</h3>
              <div className={styles.previewMeta}><span><Icon name="user" />Новый исполнитель</span><span><Icon name="clock" />{days || "0"} дн.</span></div>
              <h4>Описание</h4><p>{description || "Описание услуги"}</p>
              <h4>Что входит</h4><p>{included || "Что входит в услугу"}</p>
              {extras.some((extra) => extra.name.trim() || extra.price.trim()) && <>
                <h4>Дополнительные услуги</h4>
                {extras.map((extra, index) => <div key={index} className={styles.previewExtra}>{extra.name || "Доп. услуга"} — {extra.price || "0"} ₽</div>)}
              </>}
            </div>
          </section>}
        </aside>
      </div>
    </div>
  );
}
