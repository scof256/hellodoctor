/**
 * Tests for environment validation in root layout
 * 
 * Verifies that validateEnvironment() is integrated into the build process
 * to ensure build fails if required variables are missing.
 * 
 * Requirements: 8.1, 8.5
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Root Layout Environment Validation Integration', () => {
  it('should import and call validateEnvironment in root layout', () => {
    // Read the layout file content
    const layoutPath = join(process.cwd(), 'app', 'layout.tsx');
    const layoutContent = readFileSync(layoutPath, 'utf-8');
    
    // Verify the import statement exists
    expect(layoutContent).toContain("import { validateEnvironment } from '@/lib/env-validation'");
    
    // Verify validateEnvironment is called at module level (not inside a function)
    expect(layoutContent).toContain('validateEnvironment();');
    
    // Verify the call is before the component definition (at module load time)
    const validateCallIndex = layoutContent.indexOf('validateEnvironment();');
    const componentDefIndex = layoutContent.indexOf('export default function RootLayout');
    
    expect(validateCallIndex).toBeGreaterThan(0);
    expect(validateCallIndex).toBeLessThan(componentDefIndex);
  });
  
  it('should have comment explaining the validation purpose', () => {
    // Read the layout file content
    const layoutPath = join(process.cwd(), 'app', 'layout.tsx');
    const layoutContent = readFileSync(layoutPath, 'utf-8');
    
    // Verify there's a comment explaining the validation
    expect(layoutContent).toContain('Validate environment variables');
    expect(layoutContent).toContain('build fails if required variables are missing');
    expect(layoutContent).toContain('Requirements 8.1, 8.5');
  });
  
  it('should validate environment at module load time, not runtime', () => {
    // Read the layout file content
    const layoutPath = join(process.cwd(), 'app', 'layout.tsx');
    const layoutContent = readFileSync(layoutPath, 'utf-8');
    
    // Verify validateEnvironment is NOT called inside the component function
    const lines = layoutContent.split('\n');
    let insideComponent = false;
    let validateCallInsideComponent = false;
    
    for (const line of lines) {
      if (line.includes('export default function RootLayout')) {
        insideComponent = true;
      }
      if (insideComponent && line.includes('validateEnvironment()')) {
        validateCallInsideComponent = true;
      }
    }
    
    // Validation should NOT be inside the component
    expect(validateCallInsideComponent).toBe(false);
  });
});
