import { readFile, writeFile } from 'node:fs/promises';
import { buildExamples, splitByTimeAndGroup, evaluate, candidateWeights, observedConversion } from './evaluation.mjs';

const eventsPath = process.env.TOPK_EVENTS_FILE || process.argv[2];
if (!eventsPath) throw new Error('Thiếu file export. Dùng: node ai/topk/evaluate-real.mjs <real-events.json>');
const raw = JSON.parse(await readFile(eventsPath, 'utf8'));
if (raw.source !== 'real' || !Array.isArray(raw.events)) throw new Error('File phải là export source=real từ API Admin.');
const { items: catalog } = JSON.parse(await readFile(new URL('./data/catalog.json', import.meta.url), 'utf8'));
const examples = buildExamples(raw.events);
const splits = splitByTimeAndGroup(examples);
const models = {
  loggedTopK: evaluate(splits.test, catalog, { strategy: 'logged' }),
  lowestPrice: evaluate(splits.test, catalog, { strategy: 'lowest-price' }),
  highestRating: evaluate(splits.test, catalog, { strategy: 'highest-rating' })
};
let best = { weights: null, score: -1 };
for (const weights of candidateWeights()) {
  const metrics = evaluate(splits.train, catalog, { weights });
  if (metrics.ndcgAt5 > best.score) best = { weights, score: metrics.ndcgAt5 };
}
const minimum = { total: 100, train: 60, validation: 20, test: 20 };
const sufficient = examples.length >= minimum.total && splits.train.length >= minimum.train
  && splits.validation.length >= minimum.validation && splits.test.length >= minimum.test;
const learned = best.weights ? evaluate(splits.test, catalog, { weights: best.weights }) : null;
const validation = best.weights ? evaluate(splits.validation, catalog, { weights: best.weights }) : null;
const validationBaselines = {
  lowestPrice: evaluate(splits.validation, catalog, { strategy: 'lowest-price' }),
  highestRating: evaluate(splits.validation, catalog, { strategy: 'highest-rating' })
};
const report = { generatedAt: new Date().toISOString(), source: 'real', leakageControl: 'time-ordered identity groups',
  sampleSize: examples.length, splitSizes: Object.fromEntries(Object.entries(splits).map(([key, value]) => [key, value.length])),
  observedFunnel: observedConversion(raw.events), sufficientForTraining: sufficient, minimum,
  models: { ...models, validationBaselines, learnedWeightsValidation: validation, learnedWeights: learned }, selectedWeights: best.weights,
  promotionEligible: sufficient && learned && validation
    && validation.ndcgAt5 > Math.max(validationBaselines.lowestPrice.ndcgAt5, validationBaselines.highestRating.ndcgAt5)
    && learned.ndcgAt5 > Math.max(models.lowestPrice.ndcgAt5, models.highestRating.ndcgAt5) };
const outputPath = process.env.TOPK_REPORT_FILE || 'ai/topk/data/evaluation-report.json';
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (!sufficient) console.error('Chưa đủ dữ liệu thật để quảng bá trọng số mới; chỉ xuất báo cáo chẩn đoán.');
