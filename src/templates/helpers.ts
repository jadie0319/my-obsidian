import Handlebars from 'handlebars';

export function registerHelpers(): void {
  Handlebars.registerHelper('eq', (a, b) => {
    return a === b;
  });

  Handlebars.registerHelper('ne', (a, b) => {
    return a !== b;
  });

  Handlebars.registerHelper('or', (...args) => {
    return args.slice(0, -1).some(Boolean);
  });

  Handlebars.registerHelper('and', (...args) => {
    return args.slice(0, -1).every(Boolean);
  });
}
