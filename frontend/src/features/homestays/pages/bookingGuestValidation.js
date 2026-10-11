export function findMissingCompanionIndex(companions, declareLater) {
  if (declareLater) return -1;

  return companions.findIndex((item) =>
    !item.fullName.trim() || !item.birthDate || !item.gender ||
    (item.type === 'adult' && !item.documentNumber.trim()));
}
