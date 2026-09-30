// ==========================================================================
// BASE DE DATOS NUTRICIONAL UNIVERSAL NORMALIZADA A 100 GRAMOS
// Compatible con Barriketo v1.21.0 - Cálculo Exacto y Proporcional por Gramaje
// ==========================================================================

const FOOD_DATABASE_100G = [
  // --------------------------------------------------------------------------
  // CARNES VACUNAS Y CORTES TÍPICOS (0g Carbos Netos - Ideales Keto)
  // --------------------------------------------------------------------------
  {
    id: 'vacio',
    names: ['vacio', 'vacio vacuno', 'corte de vacio', 'vacio a la parrilla', 'vacio al horno'],
    label: 'Vacío vacuno',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 26.0, fat: 21.0, calories: 290,
    defaultGrams: 300, unitName: 'porción'
  },
  {
    id: 'bife_chorizo',
    names: ['bife de chorizo', 'bife angosto', 'entrecot', 'ojo de bife', 'bife'],
    label: 'Bife de chorizo / Ojo de bife',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 26.0, fat: 18.0, calories: 270,
    defaultGrams: 300, unitName: 'bife'
  },
  {
    id: 'entrana',
    names: ['entrana', 'entrana fina', 'entrana gruesa', 'entrana a la parrilla'],
    label: 'Entraña vacuna',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 24.0, fat: 22.0, calories: 295,
    defaultGrams: 250, unitName: 'porción'
  },
  {
    id: 'asado_tira',
    names: ['tira de asado', 'asado de tira', 'asado', 'costillar vacuno', 'asado vacuno'],
    label: 'Tira de asado / Costillar',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 23.0, fat: 25.0, calories: 315,
    defaultGrams: 350, unitName: 'tira'
  },
  {
    id: 'lomo_vacuno',
    names: ['lomo', 'bife de lomo', 'medallon de lomo', 'filet mignon'],
    label: 'Lomo vacuno magro',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 28.0, fat: 9.0, calories: 195,
    defaultGrams: 250, unitName: 'medallón'
  },
  {
    id: 'colita_cuadril',
    names: ['colita de cuadril', 'colita cuadril', 'cuadril', 'bife de cuadril'],
    label: 'Colita de cuadril / Cuadril',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 27.0, fat: 12.0, calories: 220,
    defaultGrams: 250, unitName: 'porción'
  },
  {
    id: 'matambre_vacuno',
    names: ['matambre', 'matambre vacuno', 'matambre a la parrilla', 'matambre a la pizza sin masa'],
    label: 'Matambre vacuno',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 24.0, fat: 20.0, calories: 280,
    defaultGrams: 250, unitName: 'porción'
  },
  {
    id: 'peceto',
    names: ['peceto', 'peceto al horno', 'redondo'],
    label: 'Peceto vacuno magro',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 29.0, fat: 5.0, calories: 165,
    defaultGrams: 200, unitName: 'porción'
  },
  {
    id: 'roast_beef',
    names: ['roast beef', 'aguja', 'paleta', 'palomita', 'tapa de asado', 'tapa de nalga', 'nalga'],
    label: 'Carne vacuna magra (Roast beef / Paleta / Nalga)',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 26.0, fat: 11.0, calories: 210,
    defaultGrams: 250, unitName: 'porción'
  },
  {
    id: 'carne_picada',
    names: ['carne picada', 'carne molida', 'carne picada especial', 'carne picada comun'],
    label: 'Carne picada / molida vacuna',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 24.0, fat: 18.0, calories: 260,
    defaultGrams: 200, unitName: 'porción'
  },
  {
    id: 'hamburguesa_carne',
    names: ['hamburguesa de carne', 'medallon de carne', 'hamburguesa sola', 'paty'],
    label: 'Hamburguesa casera (solo medallón de carne)',
    category: 'carnes',
    carbs: 0.5, fiber: 0, protein: 23.0, fat: 19.0, calories: 265,
    defaultGrams: 150, unitName: 'unidad'
  },
  {
    id: 'osobuco',
    names: ['osobuco', 'ossobuco'],
    label: 'Osobuco vacuno',
    category: 'carnes',
    carbs: 0, fiber: 0, protein: 25.0, fat: 12.0, calories: 210,
    defaultGrams: 250, unitName: 'porción'
  },

  // --------------------------------------------------------------------------
  // ACHURAS Y EMBUTIDOS PARRILLEROS
  // --------------------------------------------------------------------------
  {
    id: 'mollejas',
    names: ['molleja', 'mollejas', 'mollejitas'],
    label: 'Mollejas a la parrilla',
    category: 'achuras',
    carbs: 0, fiber: 0, protein: 16.0, fat: 31.0, calories: 340,
    defaultGrams: 200, unitName: 'porción'
  },
  {
    id: 'chinchulines',
    names: ['chinchulin', 'chinchulines', 'chinchu'],
    label: 'Chinchulines crocantes',
    category: 'achuras',
    carbs: 0, fiber: 0, protein: 14.0, fat: 18.0, calories: 220,
    defaultGrams: 180, unitName: 'porción'
  },
  {
    id: 'chorizo',
    names: ['chorizo', 'chorizo criollo', 'chorizo parrillero', 'chorizo de cerdo'],
    label: 'Chorizo parrillero puro',
    category: 'achuras',
    carbs: 1.5, fiber: 0, protein: 15.0, fat: 32.0, calories: 355,
    defaultGrams: 120, unitName: 'unidad'
  },
  {
    id: 'morcilla',
    names: ['morcilla', 'morcilla criolla', 'morcilla bombon'],
    label: 'Morcilla criolla',
    category: 'achuras',
    carbs: 2.0, fiber: 0, protein: 14.0, fat: 29.0, calories: 330,
    defaultGrams: 120, unitName: 'unidad'
  },
  {
    id: 'rinon',
    names: ['rinon', 'rinones', 'rinon a la parrilla', 'rinones al jerez'],
    label: 'Riñones vacunos',
    category: 'achuras',
    carbs: 0.5, fiber: 0, protein: 17.0, fat: 3.5, calories: 105,
    defaultGrams: 150, unitName: 'porción'
  },
  {
    id: 'lengua',
    names: ['lengua', 'lengua a la vinagreta'],
    label: 'Lengua a la vinagreta',
    category: 'achuras',
    carbs: 1.2, fiber: 0.2, protein: 16.0, fat: 16.0, calories: 215,
    defaultGrams: 150, unitName: 'porción'
  },
  {
    id: 'higado',
    names: ['higado', 'higado encebollado', 'higado vacuno'],
    label: 'Hígado vacuno',
    category: 'achuras',
    carbs: 3.8, fiber: 0, protein: 20.0, fat: 3.8, calories: 135,
    defaultGrams: 180, unitName: 'porción'
  },

  // --------------------------------------------------------------------------
  // AVES (POLLO Y PAVO)
  // --------------------------------------------------------------------------
  {
    id: 'pechuga_pollo',
    names: ['pechuga de pollo', 'pechuga', 'pollo pechuga', 'suprema de pollo grillada'],
    label: 'Pechuga de pollo cocida',
    category: 'aves',
    carbs: 0, fiber: 0, protein: 31.0, fat: 3.6, calories: 165,
    defaultGrams: 200, unitName: 'pechuga'
  },
  {
    id: 'pata_muslo',
    names: ['pata muslo', 'muslo de pollo', 'pata de pollo', 'cuarto trasero de pollo'],
    label: 'Pata muslo de pollo con piel',
    category: 'aves',
    carbs: 0, fiber: 0, protein: 24.0, fat: 13.0, calories: 215,
    defaultGrams: 250, unitName: 'unidad'
  },
  {
    id: 'alitas_pollo',
    names: ['alitas de pollo', 'alitas', 'alas de pollo'],
    label: 'Alitas de pollo asadas',
    category: 'aves',
    carbs: 0, fiber: 0, protein: 20.0, fat: 16.0, calories: 230,
    defaultGrams: 200, unitName: 'porción'
  },
  {
    id: 'pollo_asado',
    names: ['pollo al spiedo', 'pollo asado', 'pollo al horno', 'pollo'],
    label: 'Pollo asado con piel',
    category: 'aves',
    carbs: 0, fiber: 0, protein: 25.0, fat: 11.0, calories: 200,
    defaultGrams: 250, unitName: 'porción'
  },
  {
    id: 'pavo',
    names: ['pavo', 'pechuga de pavo', 'pavo al horno'],
    label: 'Pechuga de pavo',
    category: 'aves',
    carbs: 0, fiber: 0, protein: 29.0, fat: 2.0, calories: 135,
    defaultGrams: 200, unitName: 'porción'
  },

  // --------------------------------------------------------------------------
  // CERDO Y EMBUTIDOS
  // --------------------------------------------------------------------------
  {
    id: 'bondiola',
    names: ['bondiola', 'bondiola de cerdo', 'bondiola a la parrilla', 'bondiolita'],
    label: 'Bondiola de cerdo asada',
    category: 'cerdo',
    carbs: 0, fiber: 0, protein: 20.0, fat: 24.0, calories: 300,
    defaultGrams: 250, unitName: 'bife'
  },
  {
    id: 'solomillo_cerdo',
    names: ['solomillo de cerdo', 'solomillo', 'lomo de cerdo'],
    label: 'Solomillo de cerdo magro',
    category: 'cerdo',
    carbs: 0, fiber: 0, protein: 26.0, fat: 4.5, calories: 150,
    defaultGrams: 200, unitName: 'porción'
  },
  {
    id: 'costillita_cerdo',
    names: ['costillita de cerdo', 'chuleta de cerdo', 'carre de cerdo', 'pechito de cerdo'],
    label: 'Costillita / Pechito de cerdo',
    category: 'cerdo',
    carbs: 0, fiber: 0, protein: 22.0, fat: 18.0, calories: 255,
    defaultGrams: 250, unitName: 'costilla'
  },
  {
    id: 'panceta',
    names: ['panceta', 'bacon', 'tocino', 'panceta ahumada'],
    label: 'Panceta / Bacon crocante',
    category: 'cerdo',
    carbs: 0.5, fiber: 0, protein: 14.0, fat: 46.0, calories: 470,
    defaultGrams: 50, unitName: 'porción'
  },
  {
    id: 'jamon_crudo',
    names: ['jamon crudo', 'jamon serrano', 'prosciutto'],
    label: 'Jamón crudo / serrano estacionado',
    category: 'cerdo',
    carbs: 0.5, fiber: 0, protein: 28.0, fat: 14.0, calories: 240,
    defaultGrams: 60, unitName: 'porción'
  },
  {
    id: 'jamon_cocido',
    names: ['jamon cocido', 'paleta cocida', 'jamon natural'],
    label: 'Jamón cocido natural',
    category: 'cerdo',
    carbs: 1.0, fiber: 0, protein: 18.0, fat: 5.0, calories: 125,
    defaultGrams: 80, unitName: 'porción'
  },
  {
    id: 'salame',
    names: ['salame', 'salamin', 'cantimpalo', 'salchichon', 'fuet'],
    label: 'Salame / Salamín criollo',
    category: 'cerdo',
    carbs: 1.5, fiber: 0, protein: 22.0, fat: 38.0, calories: 435,
    defaultGrams: 60, unitName: 'porción'
  },

  // --------------------------------------------------------------------------
  // PESCADOS Y MARISCOS
  // --------------------------------------------------------------------------
  {
    id: 'salmon',
    names: ['salmon', 'salmon rosado', 'salmon a la plancha'],
    label: 'Salmón rosado fresco',
    category: 'pescados',
    carbs: 0, fiber: 0, protein: 21.0, fat: 13.5, calories: 210,
    defaultGrams: 200, unitName: 'filet'
  },
  {
    id: 'atun_natural',
    names: ['atun al natural', 'lata de atun al natural', 'atun agua'],
    label: 'Atún al natural escurrido',
    category: 'pescados',
    carbs: 0, fiber: 0, protein: 25.0, fat: 1.0, calories: 110,
    defaultGrams: 120, unitName: 'lata'
  },
  {
    id: 'atun_aceite',
    names: ['atun en aceite', 'lata de atun en aceite', 'atun'],
    label: 'Atún en aceite escurrido',
    category: 'pescados',
    carbs: 0, fiber: 0, protein: 25.0, fat: 10.0, calories: 195,
    defaultGrams: 120, unitName: 'lata'
  },
  {
    id: 'merluza',
    names: ['merluza', 'filet de merluza', 'merluza a la plancha', 'pescado blanco'],
    label: 'Filet de merluza cocido',
    category: 'pescados',
    carbs: 0, fiber: 0, protein: 18.0, fat: 1.5, calories: 88,
    defaultGrams: 200, unitName: 'filet'
  },
  {
    id: 'camarones',
    names: ['camarones', 'langostinos', 'gambas'],
    label: 'Camarones / Langostinos cocidos',
    category: 'pescados',
    carbs: 0.5, fiber: 0, protein: 24.0, fat: 1.5, calories: 115,
    defaultGrams: 150, unitName: 'porción'
  },
  {
    id: 'calamar',
    names: ['calamar', 'tubo de calamar', 'rabas sin rebozar'],
    label: 'Calamar / Tubo a la plancha',
    category: 'pescados',
    carbs: 1.5, fiber: 0, protein: 16.0, fat: 1.5, calories: 85,
    defaultGrams: 180, unitName: 'porción'
  },

  // --------------------------------------------------------------------------
  // HUEVOS Y DERIVADOS
  // --------------------------------------------------------------------------
  {
    id: 'huevo_entero',
    names: ['huevo', 'huevos', 'huevo frito', 'huevo duro', 'huevo revuelto', 'huevos revueltos', 'huevos fritos', 'huevo pasado por agua', 'huevo poche'],
    label: 'Huevo entero (55g c/u aprox)',
    category: 'huevos',
    carbs: 0.7, fiber: 0, protein: 13.0, fat: 10.5, calories: 150,
    defaultGrams: 110, unitName: 'unidad (55g)'
  },
  {
    id: 'claras_huevo',
    names: ['clara de huevo', 'claras de huevo', 'claras'],
    label: 'Claras de huevo líquidas',
    category: 'huevos',
    carbs: 0.7, fiber: 0, protein: 11.0, fat: 0.2, calories: 52,
    defaultGrams: 100, unitName: 'porción'
  },
  {
    id: 'omelette',
    names: ['omelette', 'tortilla francesa', 'omelet'],
    label: 'Omelette / Tortilla de huevos',
    category: 'huevos',
    carbs: 1.0, fiber: 0.1, protein: 13.0, fat: 13.0, calories: 175,
    defaultGrams: 150, unitName: 'unidad'
  },

  // --------------------------------------------------------------------------
  // QUESOS Y GRASAS LÁCTEAS (Keto Friendly)
  // --------------------------------------------------------------------------
  {
    id: 'queso_cremoso',
    names: ['queso cremoso', 'cremoso', 'cuartirolo', 'queso fresco'],
    label: 'Queso cremoso / Cuartirolo',
    category: 'quesos',
    carbs: 1.5, fiber: 0, protein: 18.0, fat: 23.0, calories: 290,
    defaultGrams: 60, unitName: 'feta'
  },
  {
    id: 'queso_mozzarella',
    names: ['queso muzzarella', 'muzzarella', 'mozzarella', 'queso mozzarella'],
    label: 'Queso muzzarella / mozzarella',
    category: 'quesos',
    carbs: 2.2, fiber: 0, protein: 22.0, fat: 22.0, calories: 300,
    defaultGrams: 80, unitName: 'porción'
  },
  {
    id: 'provoleta',
    names: ['provoleta', 'queso provolone', 'provolone a la parrilla', 'provolone'],
    label: 'Provoleta a la parrilla',
    category: 'quesos',
    carbs: 1.5, fiber: 0, protein: 26.0, fat: 28.0, calories: 365,
    defaultGrams: 100, unitName: 'rodaja'
  },
  {
    id: 'queso_sardo',
    names: ['queso sardo', 'queso duro', 'reggianito', 'parmesano', 'queso rallado', 'grana padano'],
    label: 'Queso duro rallado / Sardo / Parmesano',
    category: 'quesos',
    carbs: 1.8, fiber: 0, protein: 34.0, fat: 28.0, calories: 395,
    defaultGrams: 30, unitName: 'cucharada'
  },
  {
    id: 'queso_pategras',
    names: ['queso pategras', 'queso gouda', 'queso dambo', 'queso tybo', 'queso mar del plata', 'queso de maquina'],
    label: 'Queso semiduro (Gouda / Pategrás / Dambo / Tybo)',
    category: 'quesos',
    carbs: 1.5, fiber: 0, protein: 25.0, fat: 28.0, calories: 355,
    defaultGrams: 60, unitName: 'feta'
  },
  {
    id: 'queso_azul',
    names: ['queso azul', 'roquefort', 'queso roquefort', 'gorgonzola'],
    label: 'Queso azul / Roquefort',
    category: 'quesos',
    carbs: 2.0, fiber: 0, protein: 21.0, fat: 29.0, calories: 355,
    defaultGrams: 40, unitName: 'porción'
  },
  {
    id: 'queso_brie',
    names: ['queso brie', 'brie', 'camembert'],
    label: 'Queso Brie / Camembert',
    category: 'quesos',
    carbs: 0.5, fiber: 0, protein: 20.0, fat: 28.0, calories: 335,
    defaultGrams: 50, unitName: 'porción'
  },
  {
    id: 'queso_crema',
    names: ['queso crema', 'casancrem', 'philadelphia', 'finlandia', 'mendicrim'],
    label: 'Queso crema entero (tipo Finlandia/Casancrem)',
    category: 'quesos',
    carbs: 3.5, fiber: 0, protein: 6.0, fat: 25.0, calories: 260,
    defaultGrams: 50, unitName: 'cucharada'
  },
  {
    id: 'queso_ricota',
    names: ['ricota', 'queso ricota', 'ricotta', 'queso cottage'],
    label: 'Ricota magra / Cottage',
    category: 'quesos',
    carbs: 3.5, fiber: 0, protein: 11.5, fat: 4.5, calories: 100,
    defaultGrams: 100, unitName: 'porción'
  },
  {
    id: 'crema_leche',
    names: ['crema de leche', 'crema para batir', 'nata'],
    label: 'Crema de leche entera',
    category: 'lacteos',
    carbs: 2.8, fiber: 0, protein: 2.2, fat: 36.0, calories: 345,
    defaultGrams: 50, unitName: 'cucharada'
  },
  {
    id: 'manteca',
    names: ['manteca', 'mantequilla'],
    label: 'Manteca vacuna pura',
    category: 'grasas',
    carbs: 0.1, fiber: 0, protein: 0.8, fat: 82.0, calories: 725,
    defaultGrams: 20, unitName: 'cucharada'
  },
  {
    id: 'ghee',
    names: ['ghee', 'manteca clarificada'],
    label: 'Ghee / Manteca clarificada',
    category: 'grasas',
    carbs: 0, fiber: 0, protein: 0.1, fat: 99.0, calories: 890,
    defaultGrams: 15, unitName: 'cucharada'
  },

  // --------------------------------------------------------------------------
  // ACEITES Y GRASAS SALUDABLES
  // --------------------------------------------------------------------------
  {
    id: 'aceite_oliva',
    names: ['aceite de oliva', 'oliva extra virgen', 'aceite oliva virgen', 'aceite oliva'],
    label: 'Aceite de oliva virgen extra',
    category: 'grasas',
    carbs: 0, fiber: 0, protein: 0, fat: 100.0, calories: 884,
    defaultGrams: 15, unitName: 'cucharada sopera (14g)'
  },
  {
    id: 'aceite_coco',
    names: ['aceite de coco', 'aceite coco neutro'],
    label: 'Aceite de coco virgen',
    category: 'grasas',
    carbs: 0, fiber: 0, protein: 0, fat: 100.0, calories: 862,
    defaultGrams: 15, unitName: 'cucharada'
  },
  {
    id: 'mayonesa',
    names: ['mayonesa', 'mayo', 'mayonesa hellmanns'],
    label: 'Mayonesa clásica',
    category: 'grasas',
    carbs: 1.5, fiber: 0, protein: 1.0, fat: 75.0, calories: 680,
    defaultGrams: 25, unitName: 'cucharada'
  },

  // --------------------------------------------------------------------------
  // VEGETALES KETO (Muy Bajos en Carbohidratos Netos)
  // --------------------------------------------------------------------------
  {
    id: 'palta',
    names: ['palta', 'aguacate', 'media palta', 'palta hass'],
    label: 'Palta / Aguacate fresco',
    category: 'vegetales',
    carbs: 8.5, fiber: 6.7, protein: 2.0, fat: 15.0, calories: 160,
    defaultGrams: 150, unitName: 'unidad'
  },
  {
    id: 'espinaca',
    names: ['espinaca', 'espinacas', 'espinaca cocida', 'espinaca cruda'],
    label: 'Espinaca fresca / cocida',
    category: 'vegetales',
    carbs: 3.6, fiber: 2.2, protein: 2.9, fat: 0.4, calories: 23,
    defaultGrams: 150, unitName: 'taza'
  },
  {
    id: 'acelga',
    names: ['acelga', 'acelgas', 'hojas de acelga'],
    label: 'Acelga hervida / salteada',
    category: 'vegetales',
    carbs: 3.7, fiber: 1.6, protein: 1.8, fat: 0.2, calories: 20,
    defaultGrams: 150, unitName: 'porción'
  },
  {
    id: 'lechuga',
    names: ['lechuga', 'rucula', 'radicheta', 'berro', 'mix de hojas verdes', 'hojas verdes'],
    label: 'Hojas verdes (Lechuga / Rúcula / Radicheta)',
    category: 'vegetales',
    carbs: 2.8, fiber: 1.6, protein: 1.5, fat: 0.3, calories: 17,
    defaultGrams: 100, unitName: 'plato'
  },
  {
    id: 'brocoli',
    names: ['brocoli', 'arbolitos de brocoli'],
    label: 'Brócoli al vapor',
    category: 'vegetales',
    carbs: 6.6, fiber: 2.6, protein: 2.8, fat: 0.4, calories: 35,
    defaultGrams: 150, unitName: 'taza'
  },
  {
    id: 'coliflor',
    names: ['coliflor', 'pure de coliflor', 'arroz de coliflor'],
    label: 'Coliflor al vapor / Arroz de coliflor',
    category: 'vegetales',
    carbs: 5.0, fiber: 2.0, protein: 2.0, fat: 0.3, calories: 25,
    defaultGrams: 150, unitName: 'taza'
  },
  {
    id: 'zucchini',
    names: ['zucchini', 'zapallito', 'zapallitos verdes', 'calabacin'],
    label: 'Zucchini / Zapallito verde',
    category: 'vegetales',
    carbs: 3.1, fiber: 1.0, protein: 1.2, fat: 0.3, calories: 17,
    defaultGrams: 150, unitName: 'unidad'
  },
  {
    id: 'esparragos',
    names: ['esparragos', 'esparrago'],
    label: 'Espárragos grillados',
    category: 'vegetales',
    carbs: 3.9, fiber: 2.1, protein: 2.2, fat: 0.2, calories: 22,
    defaultGrams: 120, unitName: 'atado'
  },
  {
    id: 'pepino',
    names: ['pepino', 'pepinos', 'pepino en rodajas'],
    label: 'Pepino fresco',
    category: 'vegetales',
    carbs: 3.6, fiber: 0.5, protein: 0.7, fat: 0.1, calories: 15,
    defaultGrams: 100, unitName: 'unidad'
  },
  {
    id: 'apio',
    names: ['apio', 'ramas de apio'],
    label: 'Apio fresco',
    category: 'vegetales',
    carbs: 3.0, fiber: 1.6, protein: 0.7, fat: 0.2, calories: 16,
    defaultGrams: 80, unitName: 'taza'
  },
  {
    id: 'champinones',
    names: ['champinones', 'hongos', 'setas', 'portobello', 'champignon'],
    label: 'Champiñones / Portobello salteados',
    category: 'vegetales',
    carbs: 3.3, fiber: 1.0, protein: 3.1, fat: 0.3, calories: 22,
    defaultGrams: 120, unitName: 'taza'
  },
  {
    id: 'berenjena',
    names: ['berenjena', 'berenjenas al escabeche', 'berenjena asada'],
    label: 'Berenjena asada',
    category: 'vegetales',
    carbs: 5.9, fiber: 3.0, protein: 1.0, fat: 0.2, calories: 25,
    defaultGrams: 150, unitName: 'unidad'
  },
  {
    id: 'morron',
    names: ['morron', 'pimiento', 'pimiento rojo', 'morron asado', 'pimiento verde'],
    label: 'Morrón / Pimiento asado',
    category: 'vegetales',
    carbs: 6.0, fiber: 2.1, protein: 1.0, fat: 0.3, calories: 30,
    defaultGrams: 100, unitName: 'unidad'
  },
  {
    id: 'tomate',
    names: ['tomate', 'tomates', 'tomate redondo', 'tomate perita', 'tomates cherry'],
    label: 'Tomate fresco',
    category: 'vegetales',
    carbs: 3.9, fiber: 1.2, protein: 0.9, fat: 0.2, calories: 18,
    defaultGrams: 120, unitName: 'unidad'
  },
  {
    id: 'cebolla',
    names: ['cebolla', 'cebollas', 'cebolla morada', 'cebolla de verdeo'],
    label: 'Cebolla fresca / salteada',
    category: 'vegetales',
    carbs: 9.3, fiber: 1.7, protein: 1.1, fat: 0.1, calories: 40,
    defaultGrams: 80, unitName: 'unidad'
  },
  {
    id: 'repollo',
    names: ['repollo', 'col', 'repollo blanco', 'repollo morado'],
    label: 'Repollo / Col crudo o cocido',
    category: 'vegetales',
    carbs: 5.8, fiber: 2.5, protein: 1.3, fat: 0.1, calories: 25,
    defaultGrams: 120, unitName: 'taza'
  },
  {
    id: 'chauchas',
    names: ['chauchas', 'judias verdes', 'ejotes'],
    label: 'Chauchas hervidas',
    category: 'vegetales',
    carbs: 7.0, fiber: 2.7, protein: 1.8, fat: 0.2, calories: 31,
    defaultGrams: 120, unitName: 'porción'
  },
  {
    id: 'aceitunas',
    names: ['aceitunas', 'aceitunas verdes', 'aceitunas negras', 'olivas'],
    label: 'Aceitunas verdes / negras',
    category: 'vegetales',
    carbs: 3.8, fiber: 3.3, protein: 0.8, fat: 15.0, calories: 145,
    defaultGrams: 50, unitName: 'puñado'
  },

  // --------------------------------------------------------------------------
  // VEGETALES CON ALTO CARBOHIDRATO (ALERTA KETO)
  // --------------------------------------------------------------------------
  {
    id: 'papa',
    names: ['papa', 'patata', 'papas', 'papa hervida', 'papas al horno'],
    label: 'Papa cocida (Alta en carbohidratos)',
    category: 'tuberculos',
    carbs: 17.5, fiber: 2.1, protein: 2.0, fat: 0.1, calories: 77,
    defaultGrams: 200, unitName: 'unidad'
  },
  {
    id: 'batata',
    names: ['batata', 'boniato', 'camote'],
    label: 'Batata / Boniato cocido',
    category: 'tuberculos',
    carbs: 20.1, fiber: 3.0, protein: 1.6, fat: 0.1, calories: 86,
    defaultGrams: 180, unitName: 'unidad'
  },
  {
    id: 'zanahoria',
    names: ['zanahoria', 'zanahorias', 'zanahoria rallada'],
    label: 'Zanahoria fresca / cocida',
    category: 'vegetales',
    carbs: 9.6, fiber: 2.8, protein: 0.9, fat: 0.2, calories: 41,
    defaultGrams: 100, unitName: 'unidad'
  },
  {
    id: 'calabaza',
    names: ['calabaza', 'zapallo anco', 'zapallo', 'pure de calabaza'],
    label: 'Calabaza / Zapallo anco cocido',
    category: 'vegetales',
    carbs: 6.5, fiber: 1.5, protein: 1.0, fat: 0.1, calories: 26,
    defaultGrams: 150, unitName: 'porción'
  },
  {
    id: 'choclo',
    names: ['choclo', 'maiz', 'elote', 'granos de choclo'],
    label: 'Choclo / Maíz en grano',
    category: 'vegetales',
    carbs: 19.0, fiber: 2.7, protein: 3.2, fat: 1.2, calories: 86,
    defaultGrams: 120, unitName: 'espiga'
  },

  // --------------------------------------------------------------------------
  // FRUTOS SECOS Y SEMILLAS
  // --------------------------------------------------------------------------
  {
    id: 'nueces',
    names: ['nueces', 'nuez', 'mariposa de nuez'],
    label: 'Nueces peladas',
    category: 'frutos_secos',
    carbs: 13.7, fiber: 6.7, protein: 15.2, fat: 65.2, calories: 654,
    defaultGrams: 30, unitName: 'puñado'
  },
  {
    id: 'almendras',
    names: ['almendras', 'almendra', 'almendras tostadas'],
    label: 'Almendras enteras',
    category: 'frutos_secos',
    carbs: 21.6, fiber: 12.5, protein: 21.2, fat: 49.9, calories: 579,
    defaultGrams: 30, unitName: 'puñado'
  },
  {
    id: 'mani',
    names: ['mani', 'cacahuate', 'mani tostado', 'mani con sal'],
    label: 'Maní tostado',
    category: 'frutos_secos',
    carbs: 16.0, fiber: 8.5, protein: 26.0, fat: 49.0, calories: 567,
    defaultGrams: 30, unitName: 'puñado'
  },
  {
    id: 'manteca_mani',
    names: ['manteca de mani', 'pasta de mani', 'mantequilla de mani'],
    label: 'Pasta de maní pura sin azúcar',
    category: 'frutos_secos',
    carbs: 20.0, fiber: 6.0, protein: 25.0, fat: 50.0, calories: 588,
    defaultGrams: 30, unitName: 'cucharada'
  },
  {
    id: 'chia',
    names: ['semillas de chia', 'chia'],
    label: 'Semillas de chía',
    category: 'semillas',
    carbs: 42.0, fiber: 34.4, protein: 16.5, fat: 30.7, calories: 486,
    defaultGrams: 15, unitName: 'cucharada'
  },
  {
    id: 'lino',
    names: ['semillas de lino', 'lino', 'linaza'],
    label: 'Semillas de lino dorado/marrón',
    category: 'semillas',
    carbs: 29.0, fiber: 27.3, protein: 18.3, fat: 42.2, calories: 534,
    defaultGrams: 15, unitName: 'cucharada'
  },

  // --------------------------------------------------------------------------
  // FRUTAS (Keto y No-Keto)
  // --------------------------------------------------------------------------
  {
    id: 'frutillas',
    names: ['frutillas', 'fresas', 'frutilla'],
    label: 'Frutillas / Fresas frescas',
    category: 'frutas',
    carbs: 7.7, fiber: 2.0, protein: 0.7, fat: 0.3, calories: 32,
    defaultGrams: 100, unitName: 'taza'
  },
  {
    id: 'arandanos',
    names: ['arandanos', 'frutos rojos', 'frambuesas', 'moras'],
    label: 'Arándanos / Frutos rojos',
    category: 'frutas',
    carbs: 12.0, fiber: 3.5, protein: 0.8, fat: 0.4, calories: 50,
    defaultGrams: 80, unitName: 'puñado'
  },
  {
    id: 'limon',
    names: ['limon', 'jugo de limon', 'lima'],
    label: 'Limón exprimido fresco',
    category: 'frutas',
    carbs: 9.0, fiber: 2.8, protein: 1.1, fat: 0.3, calories: 29,
    defaultGrams: 50, unitName: 'unidad'
  },
  {
    id: 'manzana',
    names: ['manzana', 'manzana verde', 'manzana roja'],
    label: 'Manzana fresca (Alta en carbohidratos)',
    category: 'frutas',
    carbs: 14.0, fiber: 2.4, protein: 0.3, fat: 0.2, calories: 52,
    defaultGrams: 180, unitName: 'unidad'
  },
  {
    id: 'banana',
    names: ['banana', 'platano'],
    label: 'Banana / Plátano (Muy alto en carbohidratos)',
    category: 'frutas',
    carbs: 23.0, fiber: 2.6, protein: 1.1, fat: 0.3, calories: 89,
    defaultGrams: 120, unitName: 'unidad'
  },
  {
    id: 'naranja',
    names: ['naranja', 'mandarina', 'jugo de naranja'],
    label: 'Naranja / Jugo de naranja',
    category: 'frutas',
    carbs: 11.8, fiber: 2.4, protein: 0.9, fat: 0.1, calories: 47,
    defaultGrams: 150, unitName: 'unidad'
  },

  // --------------------------------------------------------------------------
  // PLATOS TRADICIONALES ARGENTINOS (Calculados exactamente)
  // --------------------------------------------------------------------------
  {
    id: 'milanesa_carne',
    names: ['milanesa de carne', 'milanesa', 'milanga', 'milanesa frita', 'milanesas'],
    label: 'Milanesa de carne vacuna frita',
    category: 'elaborados',
    carbs: 16.0, fiber: 0.8, protein: 20.0, fat: 16.0, calories: 288,
    defaultGrams: 180, unitName: 'milanesa'
  },
  {
    id: 'milanesa_horno',
    names: ['milanesa al horno', 'milanesa de carne al horno'],
    label: 'Milanesa de carne al horno',
    category: 'elaborados',
    carbs: 16.0, fiber: 0.8, protein: 22.0, fat: 8.0, calories: 224,
    defaultGrams: 180, unitName: 'milanesa'
  },
  {
    id: 'milanesa_pollo',
    names: ['milanesa de pollo', 'suprema frita', 'suprema'],
    label: 'Milanesa de pollo / Suprema',
    category: 'elaborados',
    carbs: 14.0, fiber: 0.5, protein: 24.0, fat: 12.0, calories: 260,
    defaultGrams: 180, unitName: 'suprema'
  },
  {
    id: 'milanesa_napolitana',
    names: ['milanesa napolitana', 'milanga napolitana', 'suprema napolitana'],
    label: 'Milanesa a la napolitana',
    category: 'elaborados',
    carbs: 14.0, fiber: 1.0, protein: 22.0, fat: 18.0, calories: 305,
    defaultGrams: 250, unitName: 'porción'
  },
  {
    id: 'empanada_carne',
    names: ['empanada de carne', 'empanada criolla', 'empanada', 'empanadas'],
    label: 'Empanada de carne tradicional',
    category: 'elaborados',
    carbs: 26.0, fiber: 1.2, protein: 9.0, fat: 12.0, calories: 245,
    defaultGrams: 90, unitName: 'empanada'
  },
  {
    id: 'empanada_jyq',
    names: ['empanada de jamon y queso', 'empanada jyq'],
    label: 'Empanada de jamón y queso',
    category: 'elaborados',
    carbs: 28.0, fiber: 1.0, protein: 11.0, fat: 14.0, calories: 280,
    defaultGrams: 90, unitName: 'empanada'
  },
  {
    id: 'pizza_muzzarella',
    names: ['pizza de muzzarella', 'pizza muzza', 'pizza', 'porcion de pizza', 'porciones de pizza'],
    label: 'Pizza de muzzarella tradicional',
    category: 'elaborados',
    carbs: 30.0, fiber: 1.8, protein: 12.0, fat: 11.0, calories: 265,
    defaultGrams: 120, unitName: 'porción'
  },
  {
    id: 'papas_fritas',
    names: ['papas fritas', 'papa frita', 'fritas'],
    label: 'Papas fritas tradicionales',
    category: 'elaborados',
    carbs: 41.0, fiber: 3.8, protein: 3.4, fat: 15.0, calories: 312,
    defaultGrams: 150, unitName: 'porción'
  },
  {
    id: 'pure_papas',
    names: ['pure de papas', 'pure de papa', 'pure'],
    label: 'Puré de papas con manteca y leche',
    category: 'elaborados',
    carbs: 15.0, fiber: 1.5, protein: 2.0, fat: 4.5, calories: 110,
    defaultGrams: 200, unitName: 'plato'
  },
  {
    id: 'ensalada_mixta',
    names: ['ensalada mixta', 'ensalada de lechuga y tomate', 'ensalada con aceite'],
    label: 'Ensalada mixta (lechuga, tomate, aceite oliva)',
    category: 'elaborados',
    carbs: 4.0, fiber: 1.8, protein: 1.2, fat: 6.0, calories: 75,
    defaultGrams: 150, unitName: 'plato'
  },
  {
    id: 'ensalada_cesar',
    names: ['ensalada cesar', 'ensalada caesar', 'cesar con pollo'],
    label: 'Ensalada César con pollo y parmesano',
    category: 'elaborados',
    carbs: 3.5, fiber: 1.5, protein: 15.0, fat: 14.0, calories: 200,
    defaultGrams: 250, unitName: 'bowl'
  },
  {
    id: 'tarta_jyq',
    names: ['tarta de jamon y queso', 'pascualina de jamon y queso'],
    label: 'Tarta de jamón y queso',
    category: 'elaborados',
    carbs: 22.0, fiber: 1.0, protein: 11.0, fat: 16.0, calories: 275,
    defaultGrams: 180, unitName: 'porción'
  },
  {
    id: 'tarta_verdura',
    names: ['tarta de verdura', 'tarta de acelga', 'tarta de espinaca', 'pascualina'],
    label: 'Tarta pascualina de acelga/espinaca',
    category: 'elaborados',
    carbs: 18.0, fiber: 2.5, protein: 8.0, fat: 12.0, calories: 210,
    defaultGrams: 180, unitName: 'porción'
  },
  {
    id: 'arroz_con_salsa',
    names: ['arroz con salsa de tomate', 'arroz con salsa', 'arroz con tuco', 'arroz con tomate', 'arroz con pomarola', 'arroz con salsa fileto'],
    label: 'Arroz blanco con salsa de tomate',
    category: 'elaborados',
    carbs: 22.0, fiber: 0.8, protein: 2.5, fat: 1.2, calories: 110,
    defaultGrams: 200, unitName: 'plato'
  },
  {
    id: 'fideos_con_salsa',
    names: ['fideos con salsa de tomate', 'fideos con salsa', 'fideos con tuco', 'pasta con tuco', 'pasta con salsa', 'tallarines con tuco', 'espaguetis con salsa'],
    label: 'Fideos / Pasta con salsa de tomate',
    category: 'elaborados',
    carbs: 24.0, fiber: 1.5, protein: 4.5, fat: 2.0, calories: 135,
    defaultGrams: 200, unitName: 'plato'
  },
  {
    id: 'arroz_con_pollo',
    names: ['arroz con pollo', 'pollo con arroz'],
    label: 'Arroz con pollo a la cacerola',
    category: 'elaborados',
    carbs: 16.0, fiber: 0.6, protein: 14.0, fat: 4.5, calories: 162,
    defaultGrams: 250, unitName: 'plato'
  },
  {
    id: 'carne_con_ensalada',
    names: ['carne con ensalada', 'bife con ensalada', 'asado con ensalada'],
    label: 'Bife / Carne con ensalada mixta',
    category: 'elaborados',
    carbs: 2.0, fiber: 1.0, protein: 22.0, fat: 14.0, calories: 225,
    defaultGrams: 250, unitName: 'plato'
  },
  {
    id: 'pollo_con_ensalada',
    names: ['pollo con ensalada', 'pechuga con ensalada'],
    label: 'Pechuga / Pollo con ensalada mixta',
    category: 'elaborados',
    carbs: 2.0, fiber: 1.0, protein: 24.0, fat: 7.0, calories: 170,
    defaultGrams: 250, unitName: 'plato'
  },
  {
    id: 'milanesa_con_pure',
    names: ['milanesa con pure', 'milanga con pure', 'suprema con pure'],
    label: 'Milanesa con puré de papas',
    category: 'elaborados',
    carbs: 16.0, fiber: 1.2, protein: 12.0, fat: 11.0, calories: 215,
    defaultGrams: 300, unitName: 'plato'
  },
  {
    id: 'guiso',
    names: ['guiso', 'guisado', 'guiso de carne', 'guiso de lentejas', 'guiso de fideos'],
    label: 'Guiso tradicional de carne y vegetales',
    category: 'elaborados',
    carbs: 12.0, fiber: 2.5, protein: 11.0, fat: 7.0, calories: 158,
    defaultGrams: 300, unitName: 'plato'
  },
  {
    id: 'tortilla_papas',
    names: ['tortilla de papas', 'tortilla de papa', 'tortilla espanola', 'tortilla'],
    label: 'Tortilla de papas tradicional',
    category: 'elaborados',
    carbs: 14.0, fiber: 1.2, protein: 6.0, fat: 10.0, calories: 172,
    defaultGrams: 150, unitName: 'porción'
  },
  {
    id: 'revuelto_gramajo',
    names: ['revuelto gramajo', 'gramajo'],
    label: 'Revuelto Gramajo (papas, huevo, jamón)',
    category: 'elaborados',
    carbs: 12.0, fiber: 1.0, protein: 11.0, fat: 14.0, calories: 220,
    defaultGrams: 200, unitName: 'plato'
  },
  {
    id: 'salsa_tomate',
    names: ['salsa de tomate', 'tuco', 'salsa tuco', 'salsa pomarola', 'pure de tomate', 'salsa fileto', 'salsa de tomates', 'salsa bolognesa', 'salsa bolonesa'],
    label: 'Salsa de tomate cocida / Tuco',
    category: 'condimentos',
    carbs: 6.5, fiber: 1.5, protein: 1.5, fat: 2.0, calories: 50,
    defaultGrams: 60, unitName: 'cucharadas'
  },
  {
    id: 'pan_blanco',
    names: ['pan', 'pan blanco', 'tostada', 'tostadas', 'flautita', 'mignon'],
    label: 'Pan blanco de panadería / Tostadas',
    category: 'panaderia',
    carbs: 50.0, fiber: 2.7, protein: 8.5, fat: 1.5, calories: 265,
    defaultGrams: 50, unitName: 'rodaja'
  },
  {
    id: 'medialuna',
    names: ['medialuna', 'medialunas', 'croissant', 'medialuna de manteca', 'medialuna de grasa'],
    label: 'Medialuna de manteca / grasa',
    category: 'panaderia',
    carbs: 52.0, fiber: 2.0, protein: 7.0, fat: 22.0, calories: 410,
    defaultGrams: 45, unitName: 'medialuna'
  },
  {
    id: 'galletitas_agua',
    names: ['galletitas de agua', 'galletitas de lino', 'crackers', 'galletitas'],
    label: 'Galletitas de agua tipo crackers',
    category: 'panaderia',
    carbs: 71.0, fiber: 2.5, protein: 9.5, fat: 11.0, calories: 420,
    defaultGrams: 40, unitName: 'porción'
  },
  {
    id: 'fideos_pasta',
    names: ['fideos', 'tallarines', 'pasta', 'espaguetis', 'ravioles', 'ñoquis'],
    label: 'Pasta / Fideos cocidos',
    category: 'harinas',
    carbs: 31.0, fiber: 1.8, protein: 5.8, fat: 0.9, calories: 158,
    defaultGrams: 200, unitName: 'plato'
  },
  {
    id: 'arroz_blanco',
    names: ['arroz', 'arroz blanco', 'arroz blanco cocido'],
    label: 'Arroz blanco cocido',
    category: 'harinas',
    carbs: 28.0, fiber: 0.4, protein: 2.7, fat: 0.3, calories: 130,
    defaultGrams: 180, unitName: 'plato'
  },

  // --------------------------------------------------------------------------
  // POSTRES Y DULCES
  // --------------------------------------------------------------------------
  {
    id: 'dulce_de_leche',
    names: ['dulce de leche', 'ddl'],
    label: 'Dulce de leche clásico',
    category: 'dulces',
    carbs: 55.0, fiber: 0, protein: 7.0, fat: 7.0, calories: 315,
    defaultGrams: 30, unitName: 'cucharada'
  },
  {
    id: 'flan_mixto',
    names: ['flan mixto', 'flan con crema y dulce de leche', 'flan con dulce y crema'],
    label: 'Flan mixto (con dulce de leche y crema)',
    category: 'dulces',
    carbs: 36.0, fiber: 0, protein: 6.0, fat: 15.0, calories: 300,
    defaultGrams: 180, unitName: 'porción'
  },
  {
    id: 'flan_casero',
    names: ['flan casero', 'flan', 'flan solo'],
    label: 'Flan casero solo',
    category: 'dulces',
    carbs: 20.0, fiber: 0, protein: 5.0, fat: 4.0, calories: 135,
    defaultGrams: 120, unitName: 'porción'
  },
  {
    id: 'chocolate_amargo_85',
    names: ['chocolate amargo 85', 'chocolate 85', 'chocolate amargo', 'chocolate negro 85'],
    label: 'Chocolate amargo 85% cacao (Keto)',
    category: 'dulces',
    carbs: 19.0, fiber: 13.0, protein: 10.0, fat: 52.0, calories: 630,
    defaultGrams: 25, unitName: 'cuadradito'
  },
  {
    id: 'chocolate_leche',
    names: ['chocolate con leche', 'chocolate comun', 'chocolate'],
    label: 'Chocolate con leche clásico',
    category: 'dulces',
    carbs: 59.0, fiber: 2.0, protein: 7.0, fat: 30.0, calories: 535,
    defaultGrams: 30, unitName: 'barra'
  },
  {
    id: 'helado',
    names: ['helado', 'helado de dulce de leche', 'cucurucho'],
    label: 'Helado tradicional de crema',
    category: 'dulces',
    carbs: 24.0, fiber: 0.5, protein: 3.5, fat: 11.0, calories: 210,
    defaultGrams: 150, unitName: 'bocha'
  },

  // --------------------------------------------------------------------------
  // BEBIDAS E INFUSIONES
  // --------------------------------------------------------------------------
  {
    id: 'cafe_solo',
    names: ['cafe', 'cafe solo', 'cafe expreso', 'cafe negro', 'pocillo de cafe'],
    label: 'Café solo / Expreso sin azúcar',
    category: 'bebidas',
    carbs: 0.2, fiber: 0, protein: 0.1, fat: 0, calories: 2,
    defaultGrams: 100, unitName: 'pocillo'
  },
  {
    id: 'mate_amargo',
    names: ['mate', 'mate amargo', 'terere'],
    label: 'Mate amargo tradicional',
    category: 'bebidas',
    carbs: 0.2, fiber: 0, protein: 0.1, fat: 0, calories: 2,
    defaultGrams: 200, unitName: 'termo'
  },
  {
    id: 'gaseosa_comun',
    names: ['coca cola', 'gaseosa', 'pepsi', 'sprite', 'fanta', 'gaseosa comun'],
    label: 'Gaseosa común con azúcar',
    category: 'bebidas',
    carbs: 10.6, fiber: 0, protein: 0, fat: 0, calories: 42,
    defaultGrams: 350, unitName: 'lata 354ml'
  },
  {
    id: 'gaseosa_zero',
    names: ['coca zero', 'gaseosa zero', 'coca light', 'pepsi black', 'sprite zero', 'agua con gas', 'soda', 'agua'],
    label: 'Gaseosa Zero / Light / Soda (0 kcal)',
    category: 'bebidas',
    carbs: 0, fiber: 0, protein: 0, fat: 0, calories: 0,
    defaultGrams: 350, unitName: 'lata 354ml'
  },
  {
    id: 'cerveza_rubia',
    names: ['cerveza', 'cerveza rubia', 'cervecita', 'porron', 'lata de cerveza', 'pinta'],
    label: 'Cerveza rubia común',
    category: 'bebidas',
    carbs: 3.6, fiber: 0, protein: 0.5, fat: 0, calories: 43,
    defaultGrams: 354, unitName: 'lata 354ml'
  },
  {
    id: 'vino_tinto',
    names: ['vino tinto', 'vino malbec', 'vino cabernet', 'copa de vino', 'vino'],
    label: 'Vino tinto seco (Malbec / Cabernet)',
    category: 'bebidas',
    carbs: 0.8, fiber: 0, protein: 0.1, fat: 0, calories: 85,
    defaultGrams: 150, unitName: 'copa 150ml'
  },
  {
    id: 'fernet_coca_zero',
    names: ['fernet con coca zero', 'fernet light', 'fernet'],
    label: 'Fernet con Coca Zero',
    category: 'bebidas',
    carbs: 0.5, fiber: 0, protein: 0, fat: 0, calories: 100,
    defaultGrams: 300, unitName: 'vaso 300ml'
  },
  {
    id: 'fernet_coca_comun',
    names: ['fernet con coca', 'fernet con coca comun', 'fernet con coca regular'],
    label: 'Fernet con Coca Cola común',
    category: 'bebidas',
    carbs: 14.0, fiber: 0, protein: 0, fat: 0, calories: 160,
    defaultGrams: 300, unitName: 'vaso 300ml'
  },
  {
    id: 'whisky',
    names: ['whisky', 'gin', 'vodka', 'tequila', 'ron'],
    label: 'Destilado puro sin mezclar (Whisky / Gin / Vodka)',
    category: 'bebidas',
    carbs: 0, fiber: 0, protein: 0, fat: 0, calories: 230,
    defaultGrams: 50, unitName: 'medida 50ml'
  },
  {
    id: 'chimichurri',
    names: ['chimichurri', 'chimi'],
    label: 'Chimichurri parrillero con aceite',
    category: 'condimentos',
    carbs: 4.0, fiber: 1.5, protein: 1.5, fat: 45.0, calories: 420,
    defaultGrams: 20, unitName: 'cucharada'
  },
  {
    id: 'salsa_criolla',
    names: ['salsa criolla', 'criolla'],
    label: 'Salsa criolla con aceite',
    category: 'condimentos',
    carbs: 5.0, fiber: 1.5, protein: 1.0, fat: 15.0, calories: 160,
    defaultGrams: 30, unitName: 'cucharada'
  }
];

// Reglas aplanadas ordenadas por longitud descendente para coincidencias óptimas
const FLATTENED_RULES_100G = [];
for (const food of FOOD_DATABASE_100G) {
  for (const name of food.names) {
    const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    FLATTENED_RULES_100G.push({
      food,
      norm,
      len: norm.length
    });
  }
}
FLATTENED_RULES_100G.sort((a, b) => b.len - a.len);

// Helper para extraer cantidades en gramos, kg o unidades en texto natural
function extractFoodQuantityGrams(text, matchStart, matchEnd, fallbackGrams) {
  // 1. Sufijo inmediato (ej: "vacio 300g", "vacio 300 gramos", "vacio 0.5kg")
  const suffix = text.slice(matchEnd, Math.min(text.length, matchEnd + 30));
  
  // Gramos en sufijo
  const gSuffix = suffix.match(/^\s*(?:de\s+)?(\d+(?:\.\d+)?)\s*(?:g|gr|gramos)\b/i);
  if (gSuffix) {
    const g = parseFloat(gSuffix[1]);
    if (!isNaN(g) && g > 0) {
      return { grams: g, isExplicitWeight: true, endPad: matchEnd + gSuffix[0].length, startPad: matchStart };
    }
  }

  // Kilogramos en sufijo (ej: "vacio 0.3kg", "asado 1kg", "carne 1/2 kg")
  const kgSuffix = suffix.match(/^\s*(?:de\s+)?(\d+(?:\.\d+)?)\s*(?:kg|kilos?)\b/i);
  if (kgSuffix) {
    const kg = parseFloat(kgSuffix[1]);
    if (!isNaN(kg) && kg > 0) {
      return { grams: kg * 1000, isExplicitWeight: true, endPad: matchEnd + kgSuffix[0].length, startPad: matchStart };
    }
  }

  // Unidades en sufijo (ej: "huevo x 2", "empanadas 3")
  const unitSuffix = suffix.match(/^\s*(?:x\s*)?(\d+(?:\.\d+)?)\s*(?:unidades?|porciones?|fetas?|rodajas?|copas?|latas?|platos?)?\b/i);
  if (unitSuffix) {
    const u = parseFloat(unitSuffix[1]);
    if (!isNaN(u) && u > 0 && u <= 20) {
      return { grams: u * fallbackGrams, isExplicitWeight: false, endPad: matchEnd + unitSuffix[0].length, startPad: matchStart, units: u };
    }
  }

  // 2. Prefijo inmediato (ej: "300g de vacio", "300g vacio", "medio kilo de asado")
  const prefixStart = Math.max(0, matchStart - 30);
  const prefix = text.slice(prefixStart, matchStart);

  // Gramos en prefijo
  const gPrefix = prefix.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramos)(?:\s+de)?\s*$/i);
  if (gPrefix) {
    const g = parseFloat(gPrefix[1]);
    if (!isNaN(g) && g > 0) {
      return { grams: g, isExplicitWeight: true, startPad: matchStart - gPrefix[0].length, endPad: matchEnd };
    }
  }

  // Kilos en prefijo
  const kgPrefix = prefix.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)(?:\s+de)?\s*$/i);
  if (kgPrefix) {
    const kg = parseFloat(kgPrefix[1]);
    if (!isNaN(kg) && kg > 0) {
      return { grams: kg * 1000, isExplicitWeight: true, startPad: matchStart - kgPrefix[0].length, endPad: matchEnd };
    }
  }

  // Fracciones en prefijo
  if (prefix.match(/(?:1\/2|medio|media)\s*(?:kilo|kg)(?:\s+de)?\s*$/i)) {
    const m = prefix.match(/(?:1\/2|medio|media)\s*(?:kilo|kg)(?:\s+de)?\s*$/i);
    return { grams: 500, isExplicitWeight: true, startPad: matchStart - m[0].length, endPad: matchEnd };
  }
  if (prefix.match(/(?:1\/4|cuarto)\s*(?:kilo|kg)(?:\s+de)?\s*$/i)) {
    const m = prefix.match(/(?:1\/4|cuarto)\s*(?:kilo|kg)(?:\s+de)?\s*$/i);
    return { grams: 250, isExplicitWeight: true, startPad: matchStart - m[0].length, endPad: matchEnd };
  }

  // Unidades en número en prefijo (ej: "2 huevos", "3 empanadas")
  const numPrefix = prefix.match(/\b(\d+(?:\.\d+)?)\s*(?:unidades?|porciones?|fetas?|rodajas?|copas?|latas?|platos?)?(?:\s+de)?\s*$/i);
  if (numPrefix) {
    const u = parseFloat(numPrefix[1]);
    if (!isNaN(u) && u > 0 && u <= 20) {
      return { grams: u * fallbackGrams, isExplicitWeight: false, startPad: matchStart - numPrefix[0].length, endPad: matchEnd, units: u };
    }
  }

  // Palabras numerales comunes
  const wordMap = [
    { regex: /\b(?:un|una|uno)\s*(?:de\s+)?$/i, val: 1 },
    { regex: /\b(?:dos)\s*(?:de\s+)?$/i, val: 2 },
    { regex: /\b(?:tres)\s*(?:de\s+)?$/i, val: 3 },
    { regex: /\b(?:cuatro)\s*(?:de\s+)?$/i, val: 4 },
    { regex: /\b(?:cinco)\s*(?:de\s+)?$/i, val: 5 },
    { regex: /\b(?:seis)\s*(?:de\s+)?$/i, val: 6 },
    { regex: /\b(?:diez)\s*(?:de\s+)?$/i, val: 10 },
    { regex: /\b(?:doce)\s*(?:de\s+)?$/i, val: 12 }
  ];
  for (const w of wordMap) {
    const wm = prefix.match(w.regex);
    if (wm) {
      return { grams: w.val * fallbackGrams, isExplicitWeight: false, startPad: matchStart - wm[0].length, endPad: matchEnd, units: w.val };
    }
  }

  // Si no se especificó nada, usamos los gramos por defecto de este alimento
  return { grams: fallbackGrams, isExplicitWeight: false, startPad: matchStart, endPad: matchEnd, units: 1 };
}

// Función central: Calcula los macros exactos según gramos especificados
function calculateMealMacrosExact(inputText, explicitGrams = null) {
  if (!inputText || !inputText.trim()) return null;

  let raw = inputText.toLowerCase().trim();
  let text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Separar conjunciones comunes
  text = text.replace(/,/g, ' y ')
             .replace(/\+/g, ' y ')
             .replace(/;/g, ' y ')
             .replace(/\s+/g, ' ');

  let workingText = text;

  // 1. Extraer peso global si fue especificado explícitamente en el control o en el texto
  let globalTargetGrams = (explicitGrams && !isNaN(explicitGrams) && explicitGrams > 0) ? parseFloat(explicitGrams) : null;

  // Si no vino desde el control de gramos, buscar si la frase entera termina o empieza con un peso
  // Ej: "arroz con salsa de tomate 50 gramos", "arroz con salsa 50g", "150g de carne con ensalada"
  if (!globalTargetGrams) {
    const trailingGramMatch = workingText.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:g|gr|gramos|kg|kilos?)\s*$/i);
    if (trailingGramMatch) {
      const rawVal = parseFloat(trailingGramMatch[1]);
      globalTargetGrams = trailingGramMatch[0].toLowerCase().includes('kg') ? rawVal * 1000 : rawVal;
      workingText = workingText.slice(0, trailingGramMatch.index).trim();
    } else {
      const leadingGramMatch = workingText.match(/^(\d+(?:\.\d+)?)\s*(?:g|gr|gramos|kg|kilos?)\s+(?:de\s+)?/i);
      if (leadingGramMatch) {
        const rawVal = parseFloat(leadingGramMatch[1]);
        globalTargetGrams = leadingGramMatch[0].toLowerCase().includes('kg') ? rawVal * 1000 : rawVal;
        workingText = workingText.slice(leadingGramMatch[0].length).trim();
      }
    }
  }

  // 2. Coincidencia de Alimentos en la Base de Datos (priorizando nombres más largos)
  const matches = [];
  const matchedFoodIds = new Set();

  for (const rule of FLATTENED_RULES_100G) {
    if (matchedFoodIds.has(rule.food.id)) continue;

    const regex = new RegExp('(?:^|\\s)(' + rule.norm.replace(/\s+/g, '\\s+') + ')(?:$|\\s)', 'i');
    const match = workingText.match(regex);
    if (match) {
      const matchStart = match.index + (match[0].startsWith(' ') ? 1 : 0);
      const matchEnd = matchStart + match[1].length;

      // Verificar si tiene un peso explícito local pegado al alimento
      const localQty = extractFoodQuantityGrams(workingText, matchStart, matchEnd, rule.food.defaultGrams);

      matches.push({
        food: rule.food,
        matchStart,
        matchEnd,
        localGrams: localQty.grams,
        hasLocalExplicitWeight: localQty.isExplicitWeight,
        defaultGrams: rule.food.defaultGrams
      });
      matchedFoodIds.add(rule.food.id);

      // Limpiar texto para evitar falsos positivos encadenados
      workingText = workingText.substring(0, matchStart) + ' '.repeat(match[1].length) + workingText.substring(matchEnd);
    }
  }

  let detectedItems = [];

  if (matches.length === 1) {
    // 1 SOLO ALIMENTO DETECTADO: El peso total se aplica íntegro a este alimento
    const m = matches[0];
    const finalGrams = globalTargetGrams || (m.hasLocalExplicitWeight ? m.localGrams : m.defaultGrams);
    const factor = finalGrams / 100.0;
    detectedItems.push({
      name: m.food.label,
      grams: finalGrams,
      isExplicit: Boolean(globalTargetGrams || m.hasLocalExplicitWeight),
      carbs: m.food.carbs * factor,
      fiber: m.food.fiber * factor,
      protein: m.food.protein * factor,
      fat: m.food.fat * factor,
      calories: m.food.calories * factor
    });
  } else if (matches.length > 1) {
    // MÚLTIPLES ALIMENTOS DETECTADOS (Platos combinados: ej. "arroz" + "salsa de tomate")
    const allHaveLocalExplicit = matches.every(m => m.hasLocalExplicitWeight);

    if (allHaveLocalExplicit && !globalTargetGrams) {
      // Caso A: Cada ingrediente tenía su propio peso escrito (ej: "100g de bife y 50g de ensalada")
      for (const m of matches) {
        const factor = m.localGrams / 100.0;
        detectedItems.push({
          name: m.food.label,
          grams: m.localGrams,
          isExplicit: true,
          carbs: m.food.carbs * factor,
          fiber: m.food.fiber * factor,
          protein: m.food.protein * factor,
          fat: m.food.fat * factor,
          calories: m.food.calories * factor
        });
      }
    } else {
      // Caso B: Plato compuesto con gramaje total único (ej. "arroz con salsa 50g" o selector en 50g)
      // La suma de los ingredientes DEBE SER EXACTAMENTE igual al peso total ingresado.
      const totalDefault = matches.reduce((sum, m) => sum + (m.defaultGrams || 100), 0);
      const targetTotalWeight = globalTargetGrams || totalDefault;

      let assignedSum = 0;
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        let itemGrams = 0;
        if (i === matches.length - 1) {
          itemGrams = Math.max(1, Math.round(targetTotalWeight - assignedSum));
        } else {
          itemGrams = Math.max(1, Math.round(targetTotalWeight * (m.defaultGrams / totalDefault)));
          assignedSum += itemGrams;
        }

        const factor = itemGrams / 100.0;
        detectedItems.push({
          name: m.food.label,
          grams: itemGrams,
          isExplicit: Boolean(globalTargetGrams),
          carbs: m.food.carbs * factor,
          fiber: m.food.fiber * factor,
          protein: m.food.protein * factor,
          fat: m.food.fat * factor,
          calories: m.food.calories * factor
        });
      }
    }
  }

  // Si no se encontró ningún alimento en la base de datos:
  if (detectedItems.length === 0) {
    const anyGramMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramos|kg)\b/i);
    const estimatedGrams = globalTargetGrams || (anyGramMatch ? parseFloat(anyGramMatch[1]) * (anyGramMatch[0].includes('kg') ? 1000 : 1) : 200);

    if (text.includes('carne') || text.includes('vaca') || text.includes('asado') || text.includes('corte') || text.includes('bife') || text.includes('muslo') || text.includes('filet')) {
      const factor = estimatedGrams / 100.0;
      detectedItems.push({
        name: `Corte de carne / proteína (${Math.round(estimatedGrams)}g)`,
        grams: Math.round(estimatedGrams),
        isExplicit: true,
        carbs: 0,
        fiber: 0,
        protein: 26.0 * factor,
        fat: 18.0 * factor,
        calories: 270.0 * factor
      });
    } else if (text.includes('ensalada') || text.includes('verdura') || text.includes('vegetal')) {
      const factor = estimatedGrams / 100.0;
      detectedItems.push({
        name: `Vegetales / Ensalada (${Math.round(estimatedGrams)}g)`,
        grams: Math.round(estimatedGrams),
        isExplicit: true,
        carbs: 4.0 * factor,
        fiber: 2.0 * factor,
        protein: 1.5 * factor,
        fat: 5.0 * factor,
        calories: 65.0 * factor
      });
    } else {
      return {
        unknown: true,
        rawInput: inputText,
        message: 'No pudimos reconocer el alimento con exactitud. Por favor ingresa los macros manualmente o selecciona un corte/alimento de la lista.'
      };
    }
  }

  // =========================================================================
  // LEY INVIOLABLE DE CONSERVACIÓN DE MASA Y CONSISTENCIA FÍSICA
  // En ningún alimento del universo conocido la suma de macronutrientes puede
  // superar el peso de la comida consumida (ej: 50g no pueden tener 52g de carbos).
  // =========================================================================
  const totalMealGrams = detectedItems.reduce((acc, item) => acc + item.grams, 0);
  let totalCarbs = detectedItems.reduce((acc, item) => acc + item.carbs, 0);
  let totalFiber = detectedItems.reduce((acc, item) => acc + item.fiber, 0);
  let totalProtein = detectedItems.reduce((acc, item) => acc + item.protein, 0);
  let totalFat = detectedItems.reduce((acc, item) => acc + item.fat, 0);

  if (totalMealGrams > 0) {
    if (totalCarbs > totalMealGrams) {
      totalCarbs = totalMealGrams * 0.90;
    }
    const macroSum = totalCarbs + totalProtein + totalFat;
    if (macroSum > totalMealGrams) {
      const scaleDown = (totalMealGrams * 0.95) / macroSum;
      totalCarbs *= scaleDown;
      totalProtein *= scaleDown;
      totalFat *= scaleDown;
    }
    if (totalFiber > totalCarbs) {
      totalFiber = totalCarbs * 0.5;
    }
  }

  const netCarbs = Math.max(0, Math.round((totalCarbs - totalFiber) * 10) / 10);
  const roundedCarbs = Math.round(totalCarbs * 10) / 10;
  const roundedFiber = Math.round(totalFiber * 10) / 10;
  const roundedProtein = Math.round(totalProtein * 10) / 10;
  const roundedFat = Math.round(totalFat * 10) / 10;
  let roundedCalories = Math.round((roundedFat * 9) + (roundedProtein * 4) + (netCarbs * 4));

  // Evaluación Cetogénica adaptada a la porción
  let ketoStatus = 'optimal';
  let ketoBadge = '🟢 100% Compatible Keto';
  let ketoNote = 'Excelente elección: bajísimo o nulo en carbohidratos netos.';

  if (netCarbs > 20) {
    ketoStatus = 'exceeded';
    ketoBadge = '🔴 Alto en Carbohidratos (Excede Límite Keto)';
    ketoNote = `Contiene ${netCarbs}g de carbohidratos netos en ${totalMealGrams}g. Podría pausar tu cetosis si supera tu tope diario.`;
  } else if (netCarbs > 8) {
    ketoStatus = 'moderate';
    ketoBadge = '🟡 Carbohidratos Moderados';
    ketoNote = `Aporta ${netCarbs}g de carbohidratos netos en ${totalMealGrams}g. Consúmelo si entra en tu límite diario.`;
  }

  // Descripción legible de todos los alimentos detectados y sus gramajes proporcionales
  const detectedSummary = detectedItems.map(item => `${item.name} [${item.grams}g]`).join(' + ');

  return {
    unknown: false,
    carbs: roundedCarbs,
    fiber: roundedFiber,
    protein: roundedProtein,
    fat: roundedFat,
    calories: roundedCalories,
    net_carbs: netCarbs,
    detected: detectedSummary,
    items: detectedItems,
    ketoStatus,
    ketoBadge,
    ketoNote
  };
}

// Búsqueda rápida para sugerencias de autocompletado en el input
function searchFoodDatabase(query, limit = 15) {
  if (!query || !query.trim()) return FOOD_DATABASE_100G.slice(0, limit);
  const qNorm = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const results = [];
  for (const item of FOOD_DATABASE_100G) {
    const matched = item.names.some(n => {
      const nNorm = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nNorm.includes(qNorm);
    }) || item.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(qNorm);

    if (matched) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }
  return results;
}

// Exponer globalmente en window y Node.js
if (typeof window !== 'undefined') {
  window.FOOD_DATABASE_100G = FOOD_DATABASE_100G;
  window.calculateMealMacrosExact = calculateMealMacrosExact;
  window.extractFoodQuantityGrams = extractFoodQuantityGrams;
  window.searchFoodDatabase = searchFoodDatabase;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FOOD_DATABASE_100G,
    calculateMealMacrosExact,
    extractFoodQuantityGrams,
    searchFoodDatabase
  };
}
