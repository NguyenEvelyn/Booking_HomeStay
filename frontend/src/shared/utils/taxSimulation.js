export const TAX_SIMULATION_STORAGE_KEY = 'tripio.tax-simulation.v1';

export const defaultTaxSimulation = Object.freeze({
  version: 'TAX-DEMO-2026.1',
  effectiveFrom: '2026-01-01',
  residentIndividualVatRate: 5,
  residentIndividualPitRate: 2,
  platformFeeRate: 10,
  platformFeeVatRate: 10,
  active: true,
});

export function readTaxSimulation() {
  try {
    const stored = JSON.parse(localStorage.getItem(TAX_SIMULATION_STORAGE_KEY) || 'null');
    return stored ? { ...defaultTaxSimulation, ...stored } : { ...defaultTaxSimulation };
  } catch {
    return { ...defaultTaxSimulation };
  }
}

export function saveTaxSimulation(value) {
  const snapshot = { ...defaultTaxSimulation, ...value, updatedAt: new Date().toISOString() };
  localStorage.setItem(TAX_SIMULATION_STORAGE_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent('tripio:tax-simulation-changed', { detail: snapshot }));
  return snapshot;
}

export function calculateTaxSimulation(grossRevenue, rule = readTaxSimulation(), taxpayerType = 'resident-individual') {
  const gross = Math.max(0, Number(grossRevenue) || 0);
  const individual = taxpayerType === 'resident-individual';
  const platformFeeNet = gross * Number(rule.platformFeeRate || 0) / 100;
  const platformFeeVat = platformFeeNet * Number(rule.platformFeeVatRate || 0) / 100;
  const hostVatWithheld = individual ? gross * Number(rule.residentIndividualVatRate || 0) / 100 : 0;
  const hostPitWithheld = individual ? gross * Number(rule.residentIndividualPitRate || 0) / 100 : 0;
  return {
    grossRevenue: Math.round(gross),
    platformFeeNet: Math.round(platformFeeNet),
    platformFeeVat: Math.round(platformFeeVat),
    platformFeeGross: Math.round(platformFeeNet + platformFeeVat),
    hostVatWithheld: Math.round(hostVatWithheld),
    hostPitWithheld: Math.round(hostPitWithheld),
    hostNetPayout: Math.round(gross - platformFeeNet - platformFeeVat - hostVatWithheld - hostPitWithheld),
  };
}
