/**
 * Phase 28: CLI Patch Validator
 * Community tool for validating JSON patches before submission
 * Prevents rule-breaking patches from being deployed
 * 
 * Usage:
 *   npx ts-node validate-patch.ts my-patch.json --report detailed
 *   npx ts-node validate-patch.ts --strict
 */

import fs from 'fs';
import path from 'path';
import { mergePatch } from '../src/engine/worldEngine';

interface ValidationReport {
  filename: string;
  isValid: boolean;
  score: number; // 0-100
  checks: ValidationCheck[];
  warnings: ValidationWarning[];
  errors: ValidationError[];
  suggestions: string[];
  timestamp: string;
}

interface ValidationCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high';
}

/**
 * Validate patch JSON structure
 */
function validateStructure(patch: any): ValidationCheck {
  const requiredFields = ['id', 'version', 'description'];
  const missing = requiredFields.filter((f) => !patch[f]);

  if (missing.length > 0) {
    return {
      name: 'Required Fields',
      status: 'fail',
      message: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  return {
    name: 'Required Fields',
    status: 'pass',
    message: 'All required fields present',
  };
}

/**
 * Check for paradox-inducing values (10x variance rule)
 */
function checkParadoxRisk(patch: any): ValidationCheck {
  const errors: string[] = [];

  // Check combat formulas
  if (patch.injectedRules?.combatFormulas) {
    const formulas = patch.injectedRules.combatFormulas;

    if (formulas.critMultiplier) {
      // Base is 3.5x, allow up to 35x (10x increase)
      if (formulas.critMultiplier > 35) {
        errors.push(
          `critMultiplier ${formulas.critMultiplier}x exceeds safe limit ` +
          `(base 3.5x, max 35x)`
        );
      }
    }

    if (formulas.damageScaleFactor) {
      // Base is 1.1x, allow up to 11x
      if (formulas.damageScaleFactor > 11 || formulas.damageScaleFactor < 0.1) {
        errors.push(
          `damageScaleFactor ${formulas.damageScaleFactor} outside safe bounds ` +
          `(0.1x to 11x)`
        );
      }
    }
  }

  if (errors.length > 0) {
    return {
      name: 'Paradox Risk Assessment',
      status: 'fail',
      message: `Paradox-inducing values detected: ${errors.join('; ')}`,
    };
  }

  return {
    name: 'Paradox Risk Assessment',
    status: 'pass',
    message: 'No extreme balance changes detected',
  };
}

/**
 * Validate narrative consistency
 */
function checkNarrativeConsistency(patch: any): ValidationCheck {
  const warnings: string[] = [];

  // Check seasonal rules
  if (patch.seasonalRules) {
    const seasons = Object.keys(patch.seasonalRules);
    const validSeasons = ['winter', 'spring', 'summer', 'autumn'];
    const invalid = seasons.filter((s) => !validSeasons.includes(s.toLowerCase()));

    if (invalid.length > 0) {
      warnings.push(`Unknown seasons: ${invalid.join(', ')}`);
    }

    // Check visual palette colors
    for (const season of Object.keys(patch.seasonalRules)) {
      const palette = patch.seasonalRules[season]?.visualPalette;
      if (palette) {
        const colors = Object.values(palette);
        for (const color of colors) {
          if (typeof color === 'string' && !color.match(/^#[0-9A-F]{6}$/i)) {
            warnings.push(
              `Invalid color format in ${season} palette: ${color}. Use #RRGGBB format.`
            );
          }
        }
      }
    }
  }

  // Check custom macro events
  if (patch.injectedRules?.customMacroEvents) {
    const events = patch.injectedRules.customMacroEvents;
    for (const event of events) {
      if (!event.type || !event.name) {
        warnings.push(
          `Macro event missing required fields: type="${event.type}", name="${event.name}"`
        );
      }

      if (event.baseSeverity !== undefined && (event.baseSeverity < 0 || event.baseSeverity > 100)) {
        warnings.push(
          `Macro event severity out of range: ${event.baseSeverity} (must be 0-100)`
        );
      }
    }
  }

  if (warnings.length > 0) {
    return {
      name: 'Narrative Consistency',
      status: 'warn',
      message: `Warnings: ${warnings.join('; ')}`,
    };
  }

  return {
    name: 'Narrative Consistency',
    status: 'pass',
    message: 'Seasonal rules and events consistent',
  };
}

/**
 * Check for immutability conflicts
 */
function checkImmutabilityViolations(patch: any): ValidationCheck {
  const hardFactsInPatch = patch.epicSoulEvents || [];

  if (hardFactsInPatch.length > 0) {
    const immutableFacts = hardFactsInPatch.filter((f: any) => f.isImmutable);

    if (immutableFacts.length > 0) {
      return {
        name: 'Hard Facts Protection',
        status: 'fail',
        message:
          `Attempting to modify ${immutableFacts.length} immutable hard facts. ` +
          `These events cannot be changed once canonicalized.`,
      };
    }
  }

  return {
    name: 'Hard Facts Protection',
    status: 'pass',
    message: 'No hard facts modification conflicts',
  };
}

/**
 * Estimate patch complexity and impact
 */
function analyzeComplexity(patch: any): ValidationCheck {
  let complexity = 0;

  // Weight different patch types
  if (patch.seasonalRules) complexity += 10;
  if (patch.injectedRules?.combatFormulas) complexity += 15;
  if (patch.injectedRules?.customMacroEvents) complexity += 20;
  if (patch.injectedRules?.lootTables) complexity += 10;

  const eventCount = patch.injectedRules?.customMacroEvents?.length || 0;
  const formulaOverrides = Object.keys(patch.injectedRules?.combatFormulas || {}).length;

  complexity += eventCount * 5;
  complexity += formulaOverrides * 8;

  let status: 'pass' | 'warn' | 'fail' = 'pass';
  let message = `Complexity score: ${complexity}`;

  if (complexity > 100) {
    status = 'warn';
    message += ' (Large patch - extensive testing recommended)';
  } else if (complexity > 150) {
    status = 'fail';
    message = `Complexity score: ${complexity} exceeds recommended limit (150). ` +
      `Consider splitting into multiple patches.`;
  }

  return {
    name: 'Patch Complexity',
    status,
    message,
  };
}

/**
 * Test patch merge (dry run)
 */
async function testPatchMerge(basePath: string, patch: any): Promise<ValidationCheck> {
  try {
    const baseContent = fs.readFileSync(basePath, 'utf-8');
    const base = JSON.parse(baseContent);

    // Attempt dry-run merge
    const result = mergePatch(base, patch, {
      validateHardFacts: true,
      checkParadox: true,
      dryRun: true,
    });

    if (result === null) {
      return {
        name: 'Merge Test',
        status: 'fail',
        message: 'Patch merge failed validation (paradox or hard facts conflict)',
      };
    }

    return {
      name: 'Merge Test',
      status: 'pass',
      message: 'Patch successfully merges with base template',
    };
  } catch (error: any) {
    return {
      name: 'Merge Test',
      status: 'fail',
      message: `Merge test error: ${error.message}`,
    };
  }
}

/**
 * Run complete validation suite
 */
export async function validatePatch(
  patchPath: string,
  basePath?: string
): Promise<ValidationReport> {
  const filename = path.basename(patchPath);
  const checks: ValidationCheck[] = [];
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];
  const suggestions: string[] = [];

  console.log(`\n📋 Validating: ${filename}\n`);

  try {
    // Load patch
    const patchContent = fs.readFileSync(patchPath, 'utf-8');
    const patch = JSON.parse(patchContent);

    // Run all checks
    checks.push(validateStructure(patch));
    checks.push(checkParadoxRisk(patch));
    checks.push(checkNarrativeConsistency(patch));
    checks.push(checkImmutabilityViolations(patch));
    checks.push(analyzeComplexity(patch));

    // Merge test if base provided
    if (basePath && fs.existsSync(basePath)) {
      checks.push(await testPatchMerge(basePath, patch));
    } else {
      suggestions.push('Provide --base flag to verify merge compatibility');
    }

    // Count results
    const failures = checks.filter((c) => c.status === 'fail').length;
    const warnings_count = checks.filter((c) => c.status === 'warn').length;
    const passes = checks.filter((c) => c.status === 'pass').length;

    // Calculate score
    let score = 100;
    score -= failures * 20;
    score -= warnings_count * 5;
    score = Math.max(0, Math.min(100, score));

    // Generate report
    const report: ValidationReport = {
      filename,
      isValid: failures === 0,
      score,
      checks,
      warnings,
      errors,
      suggestions,
      timestamp: new Date().toISOString(),
    };

    // Print report
    printReport(report);

    return report;
  } catch (error: any) {
    console.error(`❌ Validation failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Pretty-print validation report
 */
function printReport(report: ValidationReport): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`${report.isValid ? '✅ VALID' : '❌ INVALID'} - ${report.filename}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📊 VALIDATION SCORE: ${report.score}/100\n`);

  console.log('✔️  CHECKS:\n');
  for (const check of report.checks) {
    const emoji =
      check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    console.log(`${emoji} ${check.name}`);
    console.log(`   ${check.message}\n`);
  }

  if (report.suggestions.length > 0) {
    console.log('💡 SUGGESTIONS:\n');
    for (const suggestion of report.suggestions) {
      console.log(`   • ${suggestion}`);
    }
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  if (report.isValid) {
    console.log('✨ Patch is ready for deployment! ✨\n');
    console.log('Next steps:');
    console.log('1. Submit patch via Live Ops dashboard');
    console.log('2. Wait for World Author approval');
    console.log('3. Watch for paradox bleed effects in-game\n');
  } else {
    console.log('⚠️  Fix validation errors before submission.\n');
    process.exit(1);
  }
}

// CLI execution
const args = process.argv.slice(2);
const patchPath = args[0];
const basePath = args.includes('--base')
  ? args[args.indexOf('--base') + 1]
  : path.join(__dirname, '../src/data/luxfier-world.json');

if (!patchPath) {
  console.log('Usage: npx ts-node validate-patch.ts <patch-file> [--base <base-file>]');
  console.log('\nExample:');
  console.log('  npx ts-node validate-patch.ts void-wastes-patch.json');
  console.log('  npx ts-node validate-patch.ts my-patch.json --base luxfier-world.json\n');
  process.exit(1);
}

validatePatch(patchPath, basePath)
  .then((report) => {
    process.exit(report.isValid ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
