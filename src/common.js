export const excludeProperties = (obj, properties) => Object.keys(obj).reduce((result, key) => {
  if (properties.some((property) => property === key)) {
    return result;
  }

  return { ...result, [key]: obj[key] };
}, {});

export default {
  excludeProperties,
};
