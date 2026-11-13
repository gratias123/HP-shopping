// Détermine la configuration des tests avant le chargement de src/config.ts.
// Les fichiers .env locaux ne doivent pas influencer les assertions.
process.env.NODE_ENV = 'test';
process.env.DATA_MODE = 'local';
process.env.CURRENCY = 'XOF';
process.env.DEFAULT_COUNTRY = 'BJ';
