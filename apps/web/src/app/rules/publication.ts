const documentTitles = {
  "user-agreement": "Пользовательское соглашение",
  offer: "Условия заказа и оферта",
  "payment-and-refunds": "Оплата, отмена и возврат",
  privacy: "Политика обработки персональных данных",
  "performer-terms": "Условия для исполнителей",
} as const;

type DocumentId = keyof typeof documentTitles;

type LegalDocument = {
  version: string;
  effectiveDate: string;
  sections: readonly { title: string; text: readonly string[] }[];
};

type LegalPublication = {
  operator: {
    name: string;
    inn: string;
    ogrnip: string;
    address: string;
    phone: string;
    email?: string;
  };
  documents: Readonly<Record<DocumentId, LegalDocument>>;
};

// Fill from the approved publication package, including the operator's public details.
export function getApprovedLegalPublication(): LegalPublication | null {
  return null;
}

export function getLegalDocumentIndex() {
  return Object.entries(documentTitles);
}

export function getLegalDocument(slug: string) {
  if (!Object.hasOwn(documentTitles, slug)) return null;
  const id = slug as DocumentId;
  const publication = getApprovedLegalPublication();
  return publication ? { title: documentTitles[id], ...publication.documents[id] } : null;
}
