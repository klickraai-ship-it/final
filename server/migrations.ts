import { db } from './db.js';
import { emailTemplates } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { sanitizeEmailHtml, sanitizeEmailText, sanitizeSubject } from './sanitizer.js';

export async function runMigrations() {
  console.log('🔧 Running data migrations...');
  
  try {
    await sanitizeExistingTemplates();
    console.log('✅ Data migrations completed successfully');
  } catch (error) {
    console.error('❌ Data migration failed:', error);
    console.error('⚠️  Some data may not be sanitized. Please review manually.');
  }
}

async function sanitizeExistingTemplates() {
  try {
    const templates = await db.select().from(emailTemplates);
    
    if (templates.length === 0) {
      console.log('  ✓ No templates to sanitize');
      return;
    }
    
    console.log(`  🧹 Sanitizing ${templates.length} existing template(s)...`);
    
    let sanitizedCount = 0;
    for (const template of templates) {
      const sanitizedSubject = sanitizeSubject(template.subject);
      const sanitizedHtml = sanitizeEmailHtml(template.htmlContent);
      const sanitizedText = template.textContent ? sanitizeEmailText(template.textContent) : null;
      
      const needsUpdate = 
        sanitizedSubject !== template.subject ||
        sanitizedHtml !== template.htmlContent ||
        (template.textContent && sanitizedText !== template.textContent);
      
      if (needsUpdate) {
        await db
          .update(emailTemplates)
          .set({
            subject: sanitizedSubject,
            htmlContent: sanitizedHtml,
            textContent: sanitizedText,
          })
          .where(eq(emailTemplates.id, template.id));
        
        sanitizedCount++;
      }
    }
    
    if (sanitizedCount > 0) {
      console.log(`  ✓ Sanitized ${sanitizedCount} template(s) with potentially unsafe content`);
    } else {
      console.log(`  ✓ All ${templates.length} template(s) already safe`);
    }
  } catch (error) {
    console.error('  ✗ Failed to sanitize existing templates:', error);
    throw error;
  }
}
