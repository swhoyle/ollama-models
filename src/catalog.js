export function selectModels(models, { query = '', capability = '', size = '', selectedOnly = false, selected = [], sort = 'pulls', direction = 'desc' }) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return models.filter(model => {
    const text = [model.name, model.description, ...model.capabilities, ...model.sizes].join(' ').toLowerCase();
    return words.every(word => text.includes(word)) && (!capability || model.capabilities.includes(capability)) &&
      (!size || model.sizes.includes(size)) && (!selectedOnly || selected.includes(model.name));
  }).sort((a, b) => {
    const result = typeof a[sort] === 'number' ? a[sort] - b[sort] : String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''));
    return (direction === 'asc' ? result : -result) || a.name.localeCompare(b.name);
  });
}
