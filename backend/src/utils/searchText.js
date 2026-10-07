module.exports = value => String(value).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
