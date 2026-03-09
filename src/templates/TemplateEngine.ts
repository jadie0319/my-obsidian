import Handlebars from 'handlebars';
import { FileSystem } from '../utils/FileSystem';
import path from 'path';

export class TemplateEngine {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  async loadTemplate(templateName: string, templatePath: string): Promise<void> {
    const content = await FileSystem.readFile(templatePath);
    const template = Handlebars.compile(content);
    this.templates.set(templateName, template);
  }

  render(templateName: string, data: Record<string, unknown>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    return template(data);
  }

  async loadDefaultTemplates(templateDir: string): Promise<void> {
    const pageTemplatePath = path.join(templateDir, 'page.html');
    const indexTemplatePath = path.join(templateDir, 'index.html');

    await this.loadTemplate('page', pageTemplatePath);
    await this.loadTemplate('index', indexTemplatePath);
  }
}
