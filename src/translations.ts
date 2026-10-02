export type AppLanguage = 'fr' | 'ar' | 'en';

export interface Translations {
  // Brand & Top bar
  storeTagline: string;
  oranAlgeria: string;
  pricesLocked: string;
  pricesUnlocked: string;
  trackOrderBtn: string;
  
  // Navigation
  allProducts: string;
  extraitsTitle: string;
  flaconsTitle: string;
  accessoriesTitle: string;
  loginBtn: string;
  requestAccessBtn: string;
  logoutBtn: string;
  cartBtn: string;

  // Hero Section
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDeliveryNotice: string;
  heroStockNotice: string;

  // Catalog Filters
  searchPlaceholder: string;
  allCategories: string;
  filterAll: string;
  filterInStock: string;
  filterLowStock: string;
  filterOutOfStock: string;
  sortByPriceAsc: string;
  sortByPriceDesc: string;
  sortByStockDesc: string;
  sortByPopular: string;
  soldeBadge: string;
  productsFound: string;
  noProductsFound: string;

  // Product Card
  confidentialPriceBadge: string;
  loginToUnlock: string;
  perGram: string;
  perPiece: string;
  inStockGrams: string;
  inStockPieces: string;
  container100g: string;
  viewDetails: string;
  addToPreorder: string;
  outOfStock: string;

  // Cart Drawer
  cartTitle: string;
  cartEmpty: string;
  cartEmptySub: string;
  totalEstimation: string;
  clearCartBtn: string;
  proceedToPreorderBtn: string;
  loginRequiredForCheckout: string;

  // Preorder modal
  preorderTitle: string;
  preorderSubtitle: string;
  fullNameLabel: string;
  companyLabel: string;
  phoneLabel: string;
  wilayaLabel: string;
  communeLabel: string;
  addressLabel: string;
  deliveryModeHome: string;
  deliveryModeDesk: string;
  deliveryModeStore: string;
  notesLabel: string;
  confirmPreorderBtn: string;

  // Confirmation modal
  orderSuccessTitle: string;
  orderSuccessDesc: string;
  orderRefLabel: string;
  downloadPdfBtn: string;
  printPdfBtn: string;
  whatsappShareBtn: string;
  trackThisOrderBtn: string;
  closeBtn: string;

  // Tracking modal
  trackModalTitle: string;
  trackModalSubtitle: string;
  trackInputPlaceholder: string;
  trackSearchBtn: string;
  myOrdersTitle: string;
  noOrdersYet: string;
  statusPending: string;
  statusConfirmed: string;
  statusInPrep: string;
  statusDelivered: string;
  statusCancelled: string;
  orderItemsCount: string;
  orderTotalDA: string;

  // Footer
  footerRights: string;
  footerDeliveryWilayas: string;
  contactUs: string;
  callCenter: string;
  showroomOran: string;

  // View Mode & Quick Order
  showroomMode: string;
  quickOrderMode: string;
  chooseInterface: string;
  showroomModeDesc: string;
  quickOrderModeDesc: string;
  switchToQuickOrder: string;
  switchToShowroom: string;

  // Price confidentiality notices
  priceHiddenNotice: string;
  totalHiddenNotice: string;
  loginToSeePrices: string;
  unauthenticatedCanAdd: string;

  // Save preorder for later
  saveForLaterBtn: string;
  savedPreordersTitle: string;
  noSavedPreorders: string;
  restoreOrderBtn: string;
  deleteSavedOrderBtn: string;
  savedOrderSuccess: string;
  savedOrderRestored: string;
  savedDraftsCount: string;
  cartTabActive: string;
  cartTabSaved: string;

  // Quick Order Grid
  quickOrderTitle: string;
  quickOrderSubtitle: string;
  colCode: string;
  colProduct: string;
  colFamily: string;
  colAvailability: string;
  colUnitPrice: string;
  colQuantity: string;
  colAction: string;
  quickOrderSummary: string;
  addedToCart: string;
  inCart: string;
  bulkAddNotice: string;

  // Proforma & Non-logged customer checkout
  requestProformaBtn: string;
  requestProformaTitle: string;
  requestProformaSubtitle: string;
  confirmProformaBtn: string;
  proformaNotice: string;

  // Customer Auth (Login & Register Modal)
  authModalTitle: string;
  authModalSubtitle: string;
  authLoginTab: string;
  authRegisterTab: string;
  authUsernameLabel: string;
  authUsernamePlaceholder: string;
  authPasswordLabel: string;
  authPasswordPlaceholder: string;
  authLoginSubmit: string;
  authNoticeText: string;
  authRegisterFullName: string;
  authRegisterCompany: string;
  authRegisterPhone: string;
  authRegisterEmail: string;
  authRegisterWilaya: string;
  authRegisterNotes: string;
  authRegisterSubmit: string;
  authRegisterSuccessTitle: string;
  authRegisterSuccessDesc: string;

  // Favorites
  favorites: string;
  addToFavorites: string;
  removeFromFavorites: string;
  onlyFavorites: string;
  noFavoritesTitle: string;
  noFavoritesDesc: string;

  // Top Sellers & Welcome Back
  topSellers: string;
  topSellerBadge: string;
  welcomeBackTitle: string;
  welcomeBackSubtitle: string;
}

export const translations: Record<AppLanguage, Translations> = {
  fr: {
    storeTagline: 'Maison de Haute Parfumerie & Matières Premières en Algérie',
    oranAlgeria: 'Oran, Algérie',
    pricesLocked: 'Prix de gros masqués aux visiteurs',
    pricesUnlocked: 'Tarifs Professionnels Débloqués',
    trackOrderBtn: 'Suivi Précommande',

    allProducts: 'Tous les Produits',
    extraitsTitle: 'Extraits & Huiles (1g)',
    flaconsTitle: 'Flacons & Emballages',
    accessoriesTitle: 'Accessoires & Outils',
    loginBtn: 'Connexion',
    requestAccessBtn: "Demande d'accès Pro",
    logoutBtn: 'Quitter',
    cartBtn: 'Panier',

    heroBadge: 'Oran • Vente Gros & Semi-Gros en Algérie',
    heroTitle: 'Matières Premières de Haute Parfumerie',
    heroSubtitle: "Fournisseur d'extraits de parfum purs vendus au gramme (1g en contenants scellés de 100g) et sélection de flacons & packaging pour artisans parfumeurs.",
    heroDeliveryNotice: 'Expédition rapide 58 Wilayas sous 24/48h',
    heroStockNotice: 'Stock sécurisé & Bloqué 48h dès confirmation',

    searchPlaceholder: 'Rechercher un extrait, nom de parfum, flacon...',
    allCategories: 'Toutes familles olfactives',
    filterAll: 'Tous',
    filterInStock: 'En Stock',
    filterLowStock: 'Stock Limité',
    filterOutOfStock: 'Rupture',
    sortByPriceAsc: 'Prix : Croissant',
    sortByPriceDesc: 'Prix : Décroissant',
    sortByStockDesc: '🔥 Top Seller (Stock élevé)',
    sortByPopular: 'Nouveautés',
    soldeBadge: 'SOLDE',
    productsFound: 'produits trouvés',
    noProductsFound: 'Aucun produit ne correspond à votre recherche.',

    confidentialPriceBadge: 'Tarif Grossiste Réservé',
    loginToUnlock: 'Connectez-vous pour voir les prix',
    perGram: 'le gramme (1g)',
    perPiece: "l'unité",
    inStockGrams: 'g disponibles',
    inStockPieces: 'pièces disponibles',
    container100g: 'Contenant scellé de 100g',
    viewDetails: 'Fiche Produit',
    addToPreorder: 'Ajouter à la précommande',
    outOfStock: 'Actuellement en rupture',

    cartTitle: 'Votre Bon de Précommande',
    cartEmpty: 'Votre sélection est vide',
    cartEmptySub: 'Parcourez le catalogue pour réserver vos extraits et flacons.',
    totalEstimation: 'Montant Total Précommandé',
    clearCartBtn: 'Vider le panier',
    proceedToPreorderBtn: 'Valider et Générer le Bon PDF',
    loginRequiredForCheckout: 'Veuillez vous connecter pour valider votre commande',

    preorderTitle: 'Finalisation de la Précommande',
    preorderSubtitle: 'Vos matières premières seront immédiatement bloquées en stock.',
    fullNameLabel: 'Nom & Prénom',
    companyLabel: 'Nom de la Parfumerie / Atelier (Optionnel)',
    phoneLabel: 'Numéro de Téléphone Mobile',
    wilayaLabel: 'Wilaya de Livraison',
    communeLabel: 'Commune / Daira',
    addressLabel: 'Adresse exacte de livraison',
    deliveryModeHome: 'Livraison à Domicile / Boutique',
    deliveryModeDesk: 'Retrait au Bureau de Livraison',
    deliveryModeStore: 'Retrait au Magasin / Comptoir (0 DA - Gratuit)',
    notesLabel: 'Instructions spéciales pour la commande',
    confirmPreorderBtn: 'Confirmer la Réservation & Télécharger le Bon',

    orderSuccessTitle: 'Précommande Enregistrée avec Succès !',
    orderSuccessDesc: 'Votre stock est bloqué pendant 48 heures. Téléchargez votre bon de commande officiel ci-dessous.',
    orderRefLabel: 'RÉFÉRENCE COMMANDE',
    downloadPdfBtn: 'Télécharger le Bon (PDF)',
    printPdfBtn: 'Imprimer le Bon',
    whatsappShareBtn: 'Envoyer sur WhatsApp',
    trackThisOrderBtn: 'Suivre cette Précommande',
    closeBtn: 'Fermer',

    trackModalTitle: 'Suivi de vos Précommandes',
    trackModalSubtitle: 'Consultez l’état de préparation et d’expédition de vos commandes chez Tulip Fragrance.',
    trackInputPlaceholder: 'N° de Précommande (ex: PRE-2026-0001) ou N° Téléphone...',
    trackSearchBtn: 'Rechercher',
    myOrdersTitle: 'Historique de vos Précommandes',
    noOrdersYet: 'Aucune précommande trouvée avec ces identifiants.',
    statusPending: 'En attente de validation',
    statusConfirmed: 'Confirmée • Stock Réservé',
    statusInPrep: 'En cours de préparation',
    statusDelivered: 'Prête pour expédition / Livrée',
    statusCancelled: 'Annulée',
    orderItemsCount: 'articles',
    orderTotalDA: 'Total',

    footerRights: 'Tous droits réservés. Devises en Dinars Algériens (DA).',
    footerDeliveryWilayas: 'Expédition sécurisée vers les 58 Wilayas d’Algérie.',
    contactUs: 'Service Commercial & Commandes',
    callCenter: 'Lignes directes :',
    showroomOran: 'Boulevard des Lions, Bir El Djir, Oran',

    showroomMode: 'Catalogue Showroom',
    quickOrderMode: 'Commande Rapide B2B',
    chooseInterface: 'Mode de Commande :',
    showroomModeDesc: 'Affichage complet avec photos détaillées et fiches olfactives',
    quickOrderModeDesc: 'Grille express B2B pour saisie directe des quantités en gros',
    switchToQuickOrder: 'Passer en Commande Rapide',
    switchToShowroom: 'Passer en Mode Catalogue',

    priceHiddenNotice: 'Tarif pro masqué',
    totalHiddenNotice: 'Total calculé après connexion',
    loginToSeePrices: 'Connectez-vous pour débloquer les tarifs',
    unauthenticatedCanAdd: 'Sélectionnez vos quantités et ajoutez au bon librement. Les tarifs seront révélés à la connexion.',

    saveForLaterBtn: 'Sauvegarder ce bon pour plus tard',
    savedPreordersTitle: 'Bons Sauvegardés',
    noSavedPreorders: 'Aucun bon sauvegardé pour le moment.',
    restoreOrderBtn: 'Charger dans le panier',
    deleteSavedOrderBtn: 'Supprimer',
    savedOrderSuccess: 'Votre bon de précommande a été sauvegardé avec succès !',
    savedOrderRestored: 'Le bon sauvegardé a été chargé dans votre panier.',
    savedDraftsCount: 'sauvegardé(s)',
    cartTabActive: 'Bon en cours',
    cartTabSaved: 'Sauvegardés pour plus tard',

    quickOrderTitle: 'Grille de Commande Rapide B2B',
    quickOrderSubtitle: 'Sélectionnez rapidement vos extraits et flacons avec saisie directe des volumes',
    colCode: 'Code',
    colProduct: 'Matière Première / Référence',
    colFamily: 'Famille / Condit.',
    colAvailability: 'Disponibilité',
    colUnitPrice: 'Prix Unitaire',
    colQuantity: 'Quantité souhaitée',
    colAction: 'Ajout au Bon',
    quickOrderSummary: 'Articles dans votre sélection',
    addedToCart: 'Ajouté !',
    inCart: 'dans le bon',
    bulkAddNotice: 'Ajoutez directement vos volumes. Les extraits sont conditionnés en flacons d’origine scellés de 100g.',

    requestProformaBtn: 'Demander une Facture Proforma (Sans Connexion)',
    requestProformaTitle: 'Demande de Facture Proforma & Réservation',
    requestProformaSubtitle: 'Renseignez vos coordonnées pour recevoir votre proforma officielle en PDF.',
    confirmProformaBtn: 'Envoyer la Commande & Télécharger la Proforma (PDF)',
    proformaNotice: 'Sans compte client validé, votre demande sera traitée sous forme de Facture Proforma avec réservation sous 48h.',

    authModalTitle: 'Espace Professionnel B2B',
    authModalSubtitle: 'Accédez aux tarifs de gros et au système de commande',
    authLoginTab: 'Connexion Grossiste',
    authRegisterTab: "Demande d'Accès Pro",
    authUsernameLabel: "Identifiant, Nom d'utilisateur ou Email",
    authUsernamePlaceholder: 'Ex : 0555 12 34 56 ou votre identifiant',
    authPasswordLabel: 'Mot de passe',
    authPasswordPlaceholder: 'Votre mot de passe...',
    authLoginSubmit: 'Se Connecter & Débloquer les Tarifs',
    authNoticeText: "Pour préserver la confidentialité des marges de nos artisans et parfumeurs, les prix en dinars (DA) sont protégés. Connectez-vous avec vos identifiants professionnels.",
    authRegisterFullName: 'Nom & Prénom du Responsable',
    authRegisterCompany: 'Nom de la Boutique / Parfumerie / Atelier',
    authRegisterPhone: 'Numéro de Téléphone Mobile (Algérie)',
    authRegisterEmail: 'Adresse Email Professionnelle',
    authRegisterWilaya: "Wilaya d'Activité",
    authRegisterNotes: 'Précisions sur votre activité (Optionnel)',
    authRegisterSubmit: "Envoyer ma Demande d'Accès Grossiste",
    authRegisterSuccessTitle: 'Demande Envoyée avec Succès !',
    authRegisterSuccessDesc: 'Notre service commercial examine votre dossier et vous délivrera vos identifiants grossiste sous 24h.',

    favorites: 'Favoris',
    addToFavorites: 'Ajouter aux favoris',
    removeFromFavorites: 'Retirer des favoris',
    onlyFavorites: 'Mes Favoris',
    noFavoritesTitle: 'Aucun produit favori',
    noFavoritesDesc: 'Cliquez sur l’icône cœur pour conserver vos extraits et flacons préférés ici.',

    // Top Sellers & Welcome Back
    topSellers: 'Top Ventes',
    topSellerBadge: '🔥 Top Seller',
    welcomeBackTitle: 'Bienvenue de retour',
    welcomeBackSubtitle: 'Ravi de vous revoir chez Tulip Fragrance ! Tarifs grossiste et commandes débloqués.',
  },

  ar: {
    storeTagline: 'دار العطور الراقية والمواد الأولية في الجزائر',
    oranAlgeria: 'وهران، الجزائر',
    pricesLocked: 'أسعار الجملة خاصة بالمهنيين والمسجلين',
    pricesUnlocked: 'تم تفعيل أسعار الجملة للزبائن المعتمدين',
    trackOrderBtn: 'تتبع طلبيتك',

    allProducts: 'جميع المنتجات',
    extraitsTitle: 'الزيوت العطرية المركزة (1 غ)',
    flaconsTitle: 'القوارير ومستلزمات التعبئة',
    accessoriesTitle: 'الإكسسوارات واللوازم',
    loginBtn: 'تسجيل الدخول',
    requestAccessBtn: 'طلب فتح حساب مهني',
    logoutBtn: 'خروج',
    cartBtn: 'سلة الحجز',

    heroBadge: 'وهران • بيع بالجملة ونصف الجملة في الجزائر',
    heroTitle: 'المواد الأولية لصناعة العطور الفاخرة',
    heroSubtitle: 'المورد المعتمد للزيوت العطرية المركزة النقية تباع بالغرام (1غ في عبوات أصلية 100غ) وتشكيلة راقية من قوارير العطور للمحترفين.',
    heroDeliveryNotice: 'توصيل سريع وموثوق لـ 58 ولاية خلال 24/48 ساعة',
    heroStockNotice: 'حجز مؤكد للسلعة لمدة 48 ساعة فور التأكيد',

    searchPlaceholder: 'ابحث عن زيت عطري، اسم عطر، قارورة...',
    allCategories: 'جميع العائلات العطرية',
    filterAll: 'الكل',
    filterInStock: 'متوفر',
    filterLowStock: 'كمية محدودة',
    filterOutOfStock: 'نفد المخزون',
    sortByPriceAsc: 'السعر: تصاعدي',
    sortByPriceDesc: 'السعر: تنازلي',
    sortByStockDesc: '🔥 الأكثر طلباً (الأعلى مخزوناً)',
    sortByPopular: 'الجديد أولاً',
    soldeBadge: 'تخفيض خاص',
    productsFound: 'منتج متاح',
    noProductsFound: 'لم يتم العثور على منتجات مطابقة.',

    confidentialPriceBadge: 'سعر الجملة محمي للمهنيين',
    loginToUnlock: 'سجل دخولك للاطلاع على الأسعار',
    perGram: 'للغرام (1 غ)',
    perPiece: 'للقطعة',
    inStockGrams: 'غرام متوفر',
    inStockPieces: 'قطعة متوفرة',
    container100g: 'عبوة أصلية محكمة 100غ',
    viewDetails: 'تفاصيل المنتج',
    addToPreorder: 'إضافة إلى طلب الحجز',
    outOfStock: 'غير متوفر حالياً',

    cartTitle: 'وصل طلب الحجز المسبق',
    cartEmpty: 'سلتك فارغة حالياً',
    cartEmptySub: 'تصفح قائمة الزيوت والقوارير لحجز الكميات المطلوبة.',
    totalEstimation: 'المبلغ الإجمالي المحجوز',
    clearCartBtn: 'إفراغ السلة',
    proceedToPreorderBtn: 'تأكيد الحجز وتحميل وصل PDF',
    loginRequiredForCheckout: 'يرجى تسجيل الدخول لتأكيد طلبيتك',

    preorderTitle: 'تأكيد طلب المواد الأولية',
    preorderSubtitle: 'سيتم حجز بضائعك فوراً في المستودع فور إرسال الطلب.',
    fullNameLabel: 'الاسم واللقب',
    companyLabel: 'اسم ورشة العطور / المحل (اختياري)',
    phoneLabel: 'رقم الهاتف المحمول',
    wilayaLabel: 'ولاية التوصيل',
    communeLabel: 'البلدية',
    addressLabel: 'العنوان الدقيق للتسليم',
    deliveryModeHome: 'توصيل إلى غاية المحل / المنزل',
    deliveryModeDesk: 'استلام من مكتب التوصيل',
    deliveryModeStore: 'استلام مباشر من المحل / المتجر (0 دج - مجاناً)',
    notesLabel: 'ملاحظات إضافية للطلبية',
    confirmPreorderBtn: 'تأكيد الحجز وتحميل الوصل الرسمي',

    orderSuccessTitle: 'تم تسجيل طلبك بنجاح تام !',
    orderSuccessDesc: 'تم حجز بضائعك لمدة 48 ساعة كاملة. يمكنك تحميل الوصل الرسمي بصيغة PDF أدناه.',
    orderRefLabel: 'رقم الطلبية',
    downloadPdfBtn: 'تحميل الوصل (PDF)',
    printPdfBtn: 'طباعة الوصل',
    whatsappShareBtn: 'إرسال عبر واتساب',
    trackThisOrderBtn: 'تتبع حالة هذه الطلبية',
    closeBtn: 'إغلاق',

    trackModalTitle: 'تتبع مسار طلبياتك',
    trackModalSubtitle: 'اطلع في أي وقت على حالة معالجة وشحن طلبياتك لدى توليب للعطور.',
    trackInputPlaceholder: 'أدخل رقم الطلبية (مثال: PRE-2026-0001) أو رقم الهاتف...',
    trackSearchBtn: 'بحث',
    myOrdersTitle: 'سجل طلبياتك السابقة',
    noOrdersYet: 'لا توجد طلبيات مسجلة بهذه المعلومات.',
    statusPending: 'قيد المراجعة والتدقيق',
    statusConfirmed: 'مؤكدة • تم حجز المخزون',
    statusInPrep: 'قيد التحضير في الورشة',
    statusDelivered: 'جاهزة للشحن / تم التسليم',
    statusCancelled: 'ملغاة',
    orderItemsCount: 'منتجات',
    orderTotalDA: 'المجموع',

    footerRights: 'جميع الحقوق محفوظة لشركة توليب للعطور. الأسعار بالدينار الجزائري.',
    footerDeliveryWilayas: 'شحن موثوق ومؤمن لجميع ولايات الجزائر الـ 58.',
    contactUs: 'قسم المبيعات والتوزيع',
    callCenter: 'أرقام الاتصال المباشرة :',
    showroomOran: 'شارع الأسود (Boulevard des Lions)، بئر الجير، وهران',

    showroomMode: 'كتالوج العرض',
    quickOrderMode: 'الطلب السريع بالجملة',
    chooseInterface: 'طريقة التصفح والطلب :',
    showroomModeDesc: 'عرض مصور مفصل للزيوت والعطور مع بطاقة كاملة',
    quickOrderModeDesc: 'جدول سريع ومباشر لتحديد الكميات وطلب الجملة الفوري',
    switchToQuickOrder: 'التحويل إلى الطلب السريع',
    switchToShowroom: 'التحويل إلى كتالوج العرض',

    priceHiddenNotice: 'سعر الجملة محجوب',
    totalHiddenNotice: 'يُحسب بعد تسجيل الدخول',
    loginToSeePrices: 'سجل دخولك لكشف الأسعار الرسمية',
    unauthenticatedCanAdd: 'يمكنك اختيار الكميات وإضافتها للطلبية بحرية، وسيتم كشف الأسعار والمجموع فور تسجيل الدخول.',

    saveForLaterBtn: 'حفظ هذا الطلب لوقت لاحق',
    savedPreordersTitle: 'الطلبيات المحفوظة',
    noSavedPreorders: 'لا توجد طلبيات محفوظة حالياً.',
    restoreOrderBtn: 'استرجاع إلى السلة',
    deleteSavedOrderBtn: 'حذف',
    savedOrderSuccess: 'تم حفظ طلبيتك بنجاح للرجوع إليها لاحقاً !',
    savedOrderRestored: 'تم استرجاع الطلبية المحفوظة إلى سلتك.',
    savedDraftsCount: 'مسودة محفوظة',
    cartTabActive: 'الطلبية الحالية',
    cartTabSaved: 'المحفوظة لوقت لاحق',

    quickOrderTitle: 'جدول الطلب السريع B2B للمهنيين',
    quickOrderSubtitle: 'حدد المواد الأولية المطلوبة وأدخل الكميات مباشرة لإعداد طلبيتك في ثوانٍ',
    colCode: 'الرمز',
    colProduct: 'المادة الأولية / المرجع',
    colFamily: 'النوع / التعبئة',
    colAvailability: 'حالة المخزون',
    colUnitPrice: 'سعر الوحدة',
    colQuantity: 'الكمية المطلوبة',
    colAction: 'إضافة للطلب',
    quickOrderSummary: 'المنتجات المختارة في طلبيتك',
    addedToCart: 'تمت الإضافة !',
    inCart: 'في السلة',
    bulkAddNotice: 'الزيوت العطرية النقية معبأة في عبوات أصلية محكمة الإغلاق سعة 100 غرام.',

    requestProformaBtn: 'طلب فاتورة شكلية بروفورما (بدون تسجيل)',
    requestProformaTitle: 'طلب فاتورة شكلية (بروفورما) وحجز السلع',
    requestProformaSubtitle: 'أدخل معلوماتك لتوليد وتحميل الفاتورة الشكلية الرسمية وحجز الكميات بملف PDF.',
    confirmProformaBtn: 'إرسال الطلب وتحميل البروفورما (PDF)',
    proformaNotice: 'للزبائن غير المسجلين: سيتم إرسال طلبكم في شكل فاتورة شكلية مع حجز أولي للمخزون لمدة 48 ساعة.',

    authModalTitle: 'فضاء المهنيين والتجار B2B',
    authModalSubtitle: 'ولوج أسعار الجملة الرسمية ونظام الحجز المسبق للزيوت والقوارير',
    authLoginTab: 'دخول الزبائن المسجلين',
    authRegisterTab: 'طلب فتح حساب جملة',
    authUsernameLabel: 'اسم المستخدم أو البريد الإلكتروني',
    authUsernamePlaceholder: 'مثال: 0555123456 أو اسم المستخدم...',
    authPasswordLabel: 'كلمة المرور',
    authPasswordPlaceholder: 'أدخل كلمة المرور الخاصة بك...',
    authLoginSubmit: 'تسجيل الدخول وإظهار الأسعار الرسمية',
    authNoticeText: 'للحفاظ على سرية وهوامش أرباح زبائننا وصناع العطور، أسعار الجملة بالدينار الجزائري محمية وتظهر فور تسجيل الدخول بحساب معتمد.',
    authRegisterFullName: 'الاسم واللقب للمسؤول',
    authRegisterCompany: 'اسم المحل / الورشة / العلامة التجارية',
    authRegisterPhone: 'رقم الهاتف المحمول (الجزائر)',
    authRegisterEmail: 'البريد الإلكتروني المهني',
    authRegisterWilaya: 'ولاية النشاط',
    authRegisterNotes: 'تفاصيل إضافية حول نشاطكم (اختياري)',
    authRegisterSubmit: 'إرسال طلب الانضمام لأسعار الجملة',
    authRegisterSuccessTitle: 'تم إرسال طلبك بنجاح تام !',
    authRegisterSuccessDesc: 'يقوم قسم المبيعات بمراجعة طلبك وسيتم تفعيل حسابك وإرسال بيانات الدخول خلال 24 ساعة.',

    favorites: 'المفضلة',
    addToFavorites: 'إضافة للمفضلة',
    removeFromFavorites: 'إزالة من المفضلة',
    onlyFavorites: 'منتجاتي المفضلة',
    noFavoritesTitle: 'لا توجد منتجات في المفضلة',
    noFavoritesDesc: 'اضغط على رمز القلب لحفظ الزيوت والقوارير المفضلة لديك هنا.',

    // Top Sellers & Welcome Back
    topSellers: 'الأكثر طلباً',
    topSellerBadge: '🔥 الأكثر طلباً',
    welcomeBackTitle: 'أهلاً بك مجدداً',
    welcomeBackSubtitle: 'يسعدنا عودتك إلى توليب ! تم تفعيل أسعار الجملة للطلبات المسبقة.',
  },

  en: {
    storeTagline: 'Haute Parfumerie House & Raw Materials in Algeria',
    oranAlgeria: 'Oran, Algeria',
    pricesLocked: 'Wholesale prices hidden for public visitors',
    pricesUnlocked: 'Verified Wholesale Prices Unlocked',
    trackOrderBtn: 'Track Pre-order',

    allProducts: 'All Products',
    extraitsTitle: 'Fragrance Oils & Concentrates (1g)',
    flaconsTitle: 'Bottles & Packaging',
    accessoriesTitle: 'Accessories & Tools',
    loginBtn: 'Login',
    requestAccessBtn: 'Apply for Wholesale',
    logoutBtn: 'Logout',
    cartBtn: 'Cart',

    heroBadge: 'Oran • Wholesale & Semi-Wholesale in Algeria',
    heroTitle: 'Luxury Perfumery Raw Materials',
    heroSubtitle: 'Official supplier of pure perfume oil concentrates sold by gram (1g in sealed 100g containers) and premium glass bottles for artisan perfumers.',
    heroDeliveryNotice: 'Fast delivery across all 58 Algerian Wilayas in 24/48h',
    heroStockNotice: 'Stock reserved & locked for 48h upon confirmation',

    searchPlaceholder: 'Search fragrance extract, perfume style, bottle...',
    allCategories: 'All Olfactory Families',
    filterAll: 'All',
    filterInStock: 'In Stock',
    filterLowStock: 'Limited Stock',
    filterOutOfStock: 'Out of Stock',
    sortByPriceAsc: 'Price: Low to High',
    sortByPriceDesc: 'Price: High to Low',
    sortByStockDesc: '🔥 Top Seller (High Stock)',
    sortByPopular: 'New Arrivals',
    soldeBadge: 'SALE',
    productsFound: 'products found',
    noProductsFound: 'No products match your criteria.',

    confidentialPriceBadge: 'Confidential B2B Wholesale Rate',
    loginToUnlock: 'Log in to view wholesale rates',
    perGram: 'per gram (1g)',
    perPiece: 'per unit',
    inStockGrams: 'g available',
    inStockPieces: 'units available',
    container100g: 'Sealed 100g container',
    viewDetails: 'Product Specs',
    addToPreorder: 'Add to pre-order',
    outOfStock: 'Currently out of stock',

    cartTitle: 'Your Pre-Order Slip',
    cartEmpty: 'Your selection is empty',
    cartEmptySub: 'Explore our catalog to reserve concentrated oils and bottles.',
    totalEstimation: 'Estimated Total Amount',
    clearCartBtn: 'Clear Cart',
    proceedToPreorderBtn: 'Submit & Download PDF Slip',
    loginRequiredForCheckout: 'Please log in to confirm your pre-order',

    preorderTitle: 'Complete Your Pre-Order',
    preorderSubtitle: 'Your raw materials will be held in our warehouse immediately.',
    fullNameLabel: 'Full Name',
    companyLabel: 'Perfumery / Workshop Name (Optional)',
    phoneLabel: 'Mobile Phone Number',
    wilayaLabel: 'Delivery Wilaya',
    communeLabel: 'City / District',
    addressLabel: 'Exact Delivery Address',
    deliveryModeHome: 'Doorstep / Workshop Delivery',
    deliveryModeDesk: 'Delivery Office Pickup',
    deliveryModeStore: 'Direct Store / Counter Pickup (Free - 0 DZD)',
    notesLabel: 'Order Notes & Instructions',
    confirmPreorderBtn: 'Confirm Reservation & Download PDF Slip',

    orderSuccessTitle: 'Pre-Order Successfully Placed!',
    orderSuccessDesc: 'Your materials are reserved for 48 hours. Download your official PDF purchase order below.',
    orderRefLabel: 'ORDER REFERENCE',
    downloadPdfBtn: 'Download PDF Slip',
    printPdfBtn: 'Print Slip',
    whatsappShareBtn: 'Share on WhatsApp',
    trackThisOrderBtn: 'Track this Pre-Order',
    closeBtn: 'Close',

    trackModalTitle: 'Track Your Pre-Orders',
    trackModalSubtitle: 'Check the preparation and delivery progress of your Tulip Fragrance orders.',
    trackInputPlaceholder: 'Order Ref (e.g. PRE-2026-0001) or Phone Number...',
    trackSearchBtn: 'Search',
    myOrdersTitle: 'Your Order History',
    noOrdersYet: 'No pre-orders found for this reference.',
    statusPending: 'Awaiting Validation',
    statusConfirmed: 'Confirmed • Stock Reserved',
    statusInPrep: 'Being Prepared in Workshop',
    statusDelivered: 'Ready for Dispatch / Delivered',
    statusCancelled: 'Cancelled',
    orderItemsCount: 'items',
    orderTotalDA: 'Total',

    footerRights: 'All rights reserved. Currency in Algerian Dinars (DA).',
    footerDeliveryWilayas: 'Secure shipping to all 58 Wilayas of Algeria.',
    contactUs: 'Sales & Orders Department',
    callCenter: 'Direct phone lines:',
    showroomOran: 'Boulevard des Lions, Bir El Djir, Oran',

    showroomMode: 'Showroom Catalog',
    quickOrderMode: 'B2B Quick Order',
    chooseInterface: 'Ordering Experience:',
    showroomModeDesc: 'Visual catalog with detailed olfactory profiles and specs',
    quickOrderModeDesc: 'Fast B2B order matrix for direct bulk quantity entry',
    switchToQuickOrder: 'Switch to Quick Order',
    switchToShowroom: 'Switch to Showroom Catalog',

    priceHiddenNotice: 'Wholesale price hidden',
    totalHiddenNotice: 'Calculated upon login',
    loginToSeePrices: 'Log in to unlock wholesale prices',
    unauthenticatedCanAdd: 'You can freely add quantities to your order slip. Prices will be displayed upon login.',

    saveForLaterBtn: 'Save this order for later',
    savedPreordersTitle: 'Saved Pre-Orders',
    noSavedPreorders: 'No saved pre-orders yet.',
    restoreOrderBtn: 'Load into Cart',
    deleteSavedOrderBtn: 'Delete',
    savedOrderSuccess: 'Your pre-order draft has been saved successfully!',
    savedOrderRestored: 'Saved pre-order loaded into your cart.',
    savedDraftsCount: 'saved draft(s)',
    cartTabActive: 'Active Order',
    cartTabSaved: 'Saved for Later',

    quickOrderTitle: 'B2B Quick Order Sheet',
    quickOrderSubtitle: 'Quickly select perfume oils and bottles with direct quantity input',
    colCode: 'Code',
    colProduct: 'Raw Material / Reference',
    colFamily: 'Family / Packaging',
    colAvailability: 'Stock Status',
    colUnitPrice: 'Unit Price',
    colQuantity: 'Desired Quantity',
    colAction: 'Add to Slip',
    quickOrderSummary: 'Items in your selection',
    addedToCart: 'Added!',
    inCart: 'in slip',
    bulkAddNotice: 'Directly type your quantities. Pure perfume oils come in original sealed 100g bottles.',

    requestProformaBtn: 'Request Proforma Invoice (No Login)',
    requestProformaTitle: 'Proforma Invoice Request & Stock Hold',
    requestProformaSubtitle: 'Fill in your details to generate and download your official proforma slip in PDF.',
    confirmProformaBtn: 'Submit Order & Download Proforma (PDF)',
    proformaNotice: 'For guest visitors: your order will be submitted as an official Proforma Invoice with a 48h stock hold.',

    authModalTitle: 'B2B Wholesale Portal',
    authModalSubtitle: 'Access wholesale rates and fast bulk ordering system',
    authLoginTab: 'Wholesale Login',
    authRegisterTab: 'Apply for Wholesale',
    authUsernameLabel: 'Username or Email',
    authUsernamePlaceholder: 'e.g., 0555 12 34 56 or your username',
    authPasswordLabel: 'Password',
    authPasswordPlaceholder: 'Enter your password...',
    authLoginSubmit: 'Login & Reveal Wholesale Rates',
    authNoticeText: 'To protect commercial trade margins for artisan perfumers, prices in Algerian Dinars (DA) are protected and revealed upon logging into an approved account.',
    authRegisterFullName: 'Full Name of Representative',
    authRegisterCompany: 'Perfumery / Workshop / Brand Name',
    authRegisterPhone: 'Mobile Phone Number (Algeria)',
    authRegisterEmail: 'Professional Email Address',
    authRegisterWilaya: 'Business Wilaya',
    authRegisterNotes: 'Activity details / notes (Optional)',
    authRegisterSubmit: 'Submit Wholesale Access Application',
    authRegisterSuccessTitle: 'Application Submitted Successfully!',
    authRegisterSuccessDesc: 'Our sales department is reviewing your application and will dispatch your credentials within 24 hours.',

    favorites: 'Favorites',
    addToFavorites: 'Add to favorites',
    removeFromFavorites: 'Remove from favorites',
    onlyFavorites: 'My Favorites',
    noFavoritesTitle: 'No favorite products',
    noFavoritesDesc: 'Click the heart icon on any product to save it here for quick access.',

    // Top Sellers & Welcome Back
    topSellers: 'Top Sellers',
    topSellerBadge: '🔥 Top Seller',
    welcomeBackTitle: 'Welcome back',
    welcomeBackSubtitle: 'Delighted to have you back at Tulip Fragrance! B2B wholesale prices unlocked.',
  },
};
