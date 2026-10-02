import { Product, StoreSettings } from '../types';

export const INITIAL_STORE_SETTINGS: StoreSettings = {
  storeName: 'Tulip Fragrance Company',
  tagline: 'Maison de Haute Parfumerie & Matières Premières en Algérie',
  phone: '0799938399',
  phoneSecondary: '0559061552',
  whatsappPhone: '213799938399',
  telegramPhone: '213799938399',
  address: 'Boulevard des Lions, Bir El Djir',
  wilaya: '31 - Oran',
  email: 'contact@tulipfragrance.com',
  allowLowStockPreorder: true,
  minOrderAmountDA: 1000,
  telegramBotToken: '8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8',
  telegramChatId: '',
  telegramPreorderChatId: '',
  telegramProformaChatId: '',
  telegramAccessChatId: '',
  telegramNotificationsEnabled: true,
  underConstruction: true,
};

export const INITIAL_PRODUCTS: Product[] = [
  ];
