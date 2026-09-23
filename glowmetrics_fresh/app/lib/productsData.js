export const PRODUCTS = [
  {
    id: 'vip-tracker',
    title: 'VIP Client Tracker',
    description: 'Organize fans, spending, and follow-ups',
    etsy: 'https://www.etsy.com/listing/4541972932/cam-model-vip-client-tracker-fillable',
    blog: '/blog/vip-client-tracker',
  },
  {
    id: 'myfreecams-tracker',
    title: 'MyFreeCams Earnings Tracker',
    description: 'Track sessions, tokens, and earnings',
    etsy: 'https://www.etsy.com/listing/4562109324/myfreecams-earnings-tracker-cam-model',
    blog: '/blog/free-myfreecams-earnings-tracker',
  },
  {
    id: 'sph-script-pack',
    title: 'SPH Script Pack',
    description: 'Session prompts and transitions',
    etsy: 'https://www.etsy.com/listing/4541995234/playful-sph-cam-script-pack-adult',
    blog: '/blog/sph-script-pack',
  },
  {
    id: 'daddys-girl-script',
    title: "Daddy's Girl Roleplay Script Pack",
    description: 'Roleplay prompts and transitions',
    etsy: 'https://www.etsy.com/listing/4544543970/daddys-girl-roleplay-script-pack-adult',
    blog: '/blog/daddys-girl-roleplay-script-pack',
  },
  {
    id: 'spin-wheel',
    title: 'Spin the Wheel Game',
    description: 'Interactive Canva template',
    etsy: 'https://www.etsy.com/listing/4538921362/editable-spin-the-wheel-canva-template',
    blog: '/blog/spin-the-wheel-cam-game',
  },
  {
    id: 'roll-dice',
    title: 'Roll the Dice Game Pack',
    description: 'Engagement game for your room',
    etsy: 'https://www.etsy.com/listing/4541149618/cam-model-roll-the-dice-game-pack',
    blog: '/blog/roll-the-dice-game-pack',
  },
  {
    id: 'sissy-training',
    title: 'Sissy Training Obedience Bundle',
    description: 'Training guides and templates',
    etsy: 'https://www.etsy.com/listing/4537118216/sissy-punishment-guide-53pg-training',
    blog: '/blog/sissy-training-obedience-bundle',
  },
  {
    id: 'chaturbate-bundle',
    title: 'Chaturbate Earnings & Growth Bundle',
    description: 'Planning tools and earning guides',
    etsy: 'https://www.etsy.com/listing/4545112282/chaturbate-earnings-tracker-bundle-44',
    blog: '/blog/chaturbate-earnings-growth-bundle',
  },
];

export function getProductsExcept(excludeIds = []) {
  return PRODUCTS.filter(p => !excludeIds.includes(p.id));
}
