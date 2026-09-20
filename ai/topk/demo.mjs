import { readFile } from 'node:fs/promises';
import { rankHomestays } from './model.mjs';

const { items } = JSON.parse(await readFile(new URL('./data/catalog.json', import.meta.url), 'utf8'));
const province = process.argv[2] || '';
const guests = Number(process.argv[3]) || 2;
const totalBudget = Number(process.argv[4]) || 2500000;
const preferredAmenities = process.argv.slice(5);
const query = { province, guests, adults: guests, rooms: 1, nights: 2, totalBudget, preferredAmenities };
console.log(JSON.stringify({ query, topK: rankHomestays(items, query, [], 5) }, null, 2));
