/** Shared i18n labels for exports (Excel + PDF) */
export const L10N: Record<string, Record<string, string>> = {
  en: {
    title: 'Coin Collection',
    exportDate: 'Exported',
    tableOfContents: 'Contents',
    coins: 'coins',
    denomination: 'Denomination',
    year: 'Year',
    condition: 'Condition',
    country: 'Country',
    purchaseDate: 'Purchase Date',
    purchasePlace: 'Purchase Place',
    price: 'Price',
    shipping: 'Shipping',
    currency: 'Currency',
    totalCost: 'Total Cost',
    notes: 'Notes',
    sold: 'Sold',
    obverse: 'Obverse',
    reverse: 'Reverse'
  },
  ru: {
    title: 'Коллекция монет',
    exportDate: 'Экспортировано',
    tableOfContents: 'Содержание',
    coins: 'монет',
    denomination: 'Номинал',
    year: 'Год',
    condition: 'Состояние',
    country: 'Страна',
    purchaseDate: 'Дата покупки',
    purchasePlace: 'Место покупки',
    price: 'Цена',
    shipping: 'Доставка',
    currency: 'Валюта',
    totalCost: 'Общая стоимость',
    notes: 'Заметки',
    sold: 'Продан',
    obverse: 'Аверс',
    reverse: 'Реверс'
  }
}

export function t(locale: 'en' | 'ru', key: string): string {
  return L10N[locale]?.[key] ?? L10N.en[key] ?? key
}
