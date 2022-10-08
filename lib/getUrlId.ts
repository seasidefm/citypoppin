// Generate random 10 character string
export const getUrlId = () => {
  return Math.random().toString(36).substring(2, 12);
};
