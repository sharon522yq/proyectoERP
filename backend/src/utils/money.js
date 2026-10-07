module.exports = value => {
  const number = Number(value);
  const [mantissa, exponent = '0'] = Math.abs(number).toString().split('e');
  return Math.sign(number) * Math.round(Number(`${mantissa}e${Number(exponent) + 2}`)) / 100;
};
