"use client";

import { useState } from "react";

export default function CreateServicePage() {
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

  return (
    <div>
      <div
        style={{
          marginBottom: "16px",
          cursor: "pointer",
        }}
      >
        ← Назад
      </div>

      <h1
        style={{
          marginBottom: "24px",
        }}
      >
        Создание услуги
      </h1>

      <div style={{ marginBottom: "20px" }}>
        <label>
          Категория{" "}
          <span
            style={{
              color: "#DC2626",
            }}
          >
            *
          </span>
        </label>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            width: "100%",
            height: "44px",
            marginTop: "8px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: "0 12px",
          }}
        >
          <option value="">Выберите категорию</option>
          <option>📚 Помощь с заданиями</option>
          <option>🎓 Помощь с курсовыми</option>
          <option>👨‍🏫 Репетиторство</option>
          <option>💻 Программирование</option>
          <option>📐 Инженерная графика</option>
          <option>📊 Презентации</option>
          <option>📝 Рефераты и отчёты</option>
          <option>🎬 Видеомонтаж</option>
        </select>

        {errors.category && (
          <p
            style={{
              color: "#DC2626",
              marginTop: "6px",
            }}
          >
            {errors.category}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>
          Название услуги{" "}
          <span
            style={{
              color: "#DC2626",
            }}
          >
            *
          </span>
        </label>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Помогу с C++"
          style={{
            width: "100%",
            height: "44px",
            marginTop: "8px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: "0 12px",
          }}
        />

        {errors.title && (
          <p
            style={{
              color: "#DC2626",
              marginTop: "6px",
            }}
          >
            {errors.title}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>
          Описание{" "}
          <span
            style={{
              color: "#DC2626",
            }}
          >
            *
          </span>
        </label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Опишите Вашу услугу"
          style={{
            width: "100%",
            minHeight: "120px",
            marginTop: "8px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: "12px",
          }}
        />

        {errors.description && (
          <p
            style={{
              color: "#DC2626",
              marginTop: "6px",
            }}
          >
            {errors.description}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>
          Цена{" "}
          <span
            style={{
              color: "#DC2626",
            }}
          >
            *
          </span>
        </label>

        <input
            type="number"
            min="10"
            max="1000000"
            value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="500"
          style={{
            width: "100%",
            height: "44px",
            marginTop: "8px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: "0 12px",
          }}
        />

        {errors.price && (
          <p
            style={{
              color: "#DC2626",
              marginTop: "6px",
            }}
          >
            {errors.price}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>
          Срок выполнения (дней){" "}
          <span
            style={{
              color: "#DC2626",
            }}
          >
            *
          </span>
        </label>

        <input
            type="number"
            min="1"
            max="365"
            value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="3"
          style={{
            width: "100%",
            height: "44px",
            marginTop: "8px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: "0 12px",
          }}
        />

        {errors.days && (
          <p
            style={{
              color: "#DC2626",
              marginTop: "6px",
            }}
          >
            {errors.days}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>
          Что входит{" "}
          <span
            style={{
              color: "#DC2626",
            }}
          >
            *
          </span>
        </label>

        <textarea
          value={included}
          onChange={(e) => setIncluded(e.target.value)}
          placeholder="Перечислите, что получит заказчик"
          style={{
            width: "100%",
            minHeight: "100px",
            marginTop: "8px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: "12px",
          }}
        />

        {errors.included && (
          <p
            style={{
              color: "#DC2626",
              marginTop: "6px",
            }}
          >
            {errors.included}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "40px" }}>
  <label>Фото услуги</label>

  <input
    id="service-image"
    type="file"
    accept="image/*"
    onChange={handleImageUpload}
    style={{
      display: "none",
    }}
  />

  <label
    htmlFor="service-image"
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      height: "44px",
      marginTop: "10px",
      borderRadius: "12px",
      border: "1px solid #E5E7EB",
      cursor: "pointer",
      background: "#FFFFFF",
    }}
  >
    Загрузить фото
  </label>

  {fileName && (
    <p
      style={{
        marginTop: "10px",
        fontSize: "14px",
      }}
    >
      {fileName}
    </p>
  )}

  {imagePreview && (
    <>
      <img
        src={imagePreview}
        alt="Фото услуги"
        style={{
          width: "100%",
          maxHeight: "250px",
          objectFit: "cover",
          borderRadius: "12px",
          border: "1px solid #E5E7EB",
          marginTop: "10px",
        }}
      />

      <button
        type="button"
        onClick={removeImage}
        style={{
          width: "100%",
          height: "44px",
          marginTop: "10px",
          borderRadius: "12px",
          border: "1px solid #DC2626",
          background: "#FFFFFF",
          color: "#DC2626",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Удалить фото
      </button>
    </>
  )}
</div>

      <h3
        style={{
          marginBottom: "10px",
        }}
      >
        Дополнительные услуги
      </h3>

      {extras.map((extra, index) => (
  <div
    key={index}
    style={{
      border: "1px solid #E5E7EB",
      borderRadius: "12px",
      padding: "16px",
      marginBottom: "16px",
    }}
  >
    <input
      value={extra.name}
      onChange={(e) =>
        updateExtra(
          index,
          "name",
          e.target.value
        )
      }
      placeholder="Название доп. услуги"
      style={{
        width: "100%",
        height: "44px",
        marginBottom: "10px",
        borderRadius: "12px",
        border: "1px solid #E5E7EB",
        padding: "0 12px",
      }}
    />

    <input
      type="number"
      min="10"
      value={extra.price}
      onChange={(e) =>
        updateExtra(
          index,
          "price",
          e.target.value
        )
      }
      placeholder="Цена"
      style={{
        width: "100%",
        height: "44px",
        borderRadius: "12px",
        border: "1px solid #E5E7EB",
        padding: "0 12px",
      }}
    />

    {extras.length > 1 && (
      <button
        type="button"
        onClick={() => removeExtra(index)}
        style={{
          width: "100%",
          height: "44px",
          marginTop: "10px",
          borderRadius: "12px",
          border: "1px solid #DC2626",
          background: "#FFFFFF",
          color: "#DC2626",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Удалить
      </button>
    )}
  </div>
))}

      <button
        onClick={addExtraService}
        style={{
          width: "100%",
          height: "44px",
          marginBottom: "24px",
          borderRadius: "12px",
          border: "1px solid #3547B8",
          background: "#FFFFFF",
          color: "#3547B8",
          fontWeight: 600,
        }}
      >
        + Добавить ещё
      </button>

    <button
  type="button"
  onClick={() =>
    setShowPreview(!showPreview)
  }
  style={{
    width: "100%",
    height: "52px",
    marginBottom: "16px",
    borderRadius: "12px",
    border: "1px solid #3547B8",
    background: "#FFFFFF",
    color: "#3547B8",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  Предпросмотреть услугу
</button>
{showPreview && (
  <div
    style={{
      border: "1px solid #E5E7EB",
      borderRadius: "16px",
      padding: "16px",
      marginBottom: "24px",
    }}
  >
    {imagePreview ? (
      <img
        src={imagePreview}
        alt="preview"
        style={{
          width: "100%",
          height: "180px",
          objectFit: "cover",
          borderRadius: "12px",
          marginBottom: "16px",
        }}
      />
    ) : (
      <div
        style={{
          height: "180px",
          background: "#F3F4F6",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
        }}
      >
        Фото услуги
      </div>
    )}

    <p
      style={{
        color: "#3547B8",
        fontWeight: 700,
        fontSize: "22px",
        marginBottom: "0",
      }}
    >
      {price || "0"} ₽
    </p>

    <h3>
      {title || "Название услуги"}
    </h3>

    <p>⭐ Новый исполнитель</p>

    <p>
      ⏱ {days || "0"} дн.
    </p>

    <h4>Описание</h4>

    <p>
      {description ||
        "Описание услуги"}
    </p>

    <h4>Что входит</h4>

    <p>
      {included ||
        "Что входит в услугу"}
    </p>

    {extras.some(
      (extra) =>
        extra.name.trim() ||
        extra.price.trim()
    ) && (
      <>
        <h4>
          Дополнительные услуги
        </h4>

        {extras.map((extra, index) => (
          <div
            key={index}
            style={{
              border:
                "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "12px",
              marginBottom: "8px",
            }}
          >
            {extra.name || "Доп. услуга"} —{" "}
            {extra.price || "0"} ₽
          </div>
        ))}
      </>
    )}
  </div>
)}


      <button
        onClick={handleSubmit}
        style={{
          width: "100%",
          height: "52px",
          border: "none",
          borderRadius: "12px",
          background: "#3547B8",
          color: "#FFFFFF",
          fontWeight: 600,
          marginBottom: "20px",
          cursor: "pointer",
        }}
      >
        Проверить демо-форму
      </button>
    </div>
  );
}
