import { Ingredient, NutritionalInfo } from '@/types';

export class ScalingUtils {
  /**
   * Scale ingredients for different serving sizes
   */
  static scaleIngredients(
    ingredients: Ingredient[],
    originalServings: number,
    newServings: number
  ): Ingredient[] {
    const scaleFactor = newServings / originalServings;
    
    return ingredients.map(ingredient => ({
      ...ingredient,
      amount: this.roundToReasonablePrecision(ingredient.amount * scaleFactor, ingredient.unit)
    }));
  }

  /**
   * Scale nutritional information for different serving sizes
   */
  static scaleNutrition(
    nutrition: NutritionalInfo,
    originalServings: number,
    newServings: number
  ): NutritionalInfo {
    const scaleFactor = newServings / originalServings;
    
    return {
      calories: Math.round(nutrition.calories * scaleFactor),
      protein: this.roundToDecimal(nutrition.protein * scaleFactor, 1),
      carbohydrates: this.roundToDecimal(nutrition.carbohydrates * scaleFactor, 1),
      fat: this.roundToDecimal(nutrition.fat * scaleFactor, 1),
      fiber: this.roundToDecimal(nutrition.fiber * scaleFactor, 1),
      sugar: this.roundToDecimal(nutrition.sugar * scaleFactor, 1),
      sodium: this.roundToDecimal(nutrition.sodium * scaleFactor, 1),
      vitamins: this.scaleNutrientObject(nutrition.vitamins, scaleFactor),
      minerals: this.scaleNutrientObject(nutrition.minerals, scaleFactor),
      servingSize: newServings
    };
  }

  /**
   * Scale cooking time based on serving size (with diminishing returns)
   */
  static scaleCookingTime(originalTime: number, originalServings: number, newServings: number): number {
    const scaleFactor = newServings / originalServings;
    
    // Cooking time doesn't scale linearly - use logarithmic scaling
    if (scaleFactor <= 1) {
      // Smaller portions cook faster, but not proportionally
      return Math.round(originalTime * (0.7 + 0.3 * scaleFactor));
    } else {
      // Larger portions take longer, but with diminishing returns
      return Math.round(originalTime * (1 + 0.3 * Math.log(scaleFactor)));
    }
  }

  /**
   * Adjust difficulty based on serving size
   */
  static scaleDifficulty(originalDifficulty: number, originalServings: number, newServings: number): number {
    const scaleFactor = newServings / originalServings;
    
    // Very small portions might be trickier (precision)
    if (scaleFactor < 0.5) {
      return Math.min(5, originalDifficulty + 1);
    }
    
    // Very large portions might be more challenging (logistics)
    if (scaleFactor > 3) {
      return Math.min(5, originalDifficulty + 1);
    }
    
    return originalDifficulty;
  }

  /**
   * Convert between common measurement units
   */
  static convertUnit(amount: number, fromUnit: string, toUnit: string): number {
    const conversions: Record<string, Record<string, number>> = {
      // Volume conversions (to ml)
      'ml': { 'ml': 1, 'l': 0.001, 'cup': 0.00422675, 'tbsp': 0.067628, 'tsp': 0.202884 },
      'l': { 'ml': 1000, 'l': 1, 'cup': 4.22675, 'tbsp': 67.628, 'tsp': 202.884 },
      'cup': { 'ml': 236.588, 'l': 0.236588, 'cup': 1, 'tbsp': 16, 'tsp': 48 },
      'tbsp': { 'ml': 14.7868, 'l': 0.0147868, 'cup': 0.0625, 'tbsp': 1, 'tsp': 3 },
      'tsp': { 'ml': 4.92892, 'l': 0.00492892, 'cup': 0.0208333, 'tbsp': 0.333333, 'tsp': 1 },
      
      // Weight conversions (to grams)
      'g': { 'g': 1, 'kg': 0.001, 'oz': 0.035274, 'lb': 0.00220462 },
      'kg': { 'g': 1000, 'kg': 1, 'oz': 35.274, 'lb': 2.20462 },
      'oz': { 'g': 28.3495, 'kg': 0.0283495, 'oz': 1, 'lb': 0.0625 },
      'lb': { 'g': 453.592, 'kg': 0.453592, 'oz': 16, 'lb': 1 }
    };

    const fromLower = fromUnit.toLowerCase();
    const toLower = toUnit.toLowerCase();

    if (conversions[fromLower] && conversions[fromLower][toLower]) {
      return amount * conversions[fromLower][toLower];
    }

    // If no conversion found, return original amount
    return amount;
  }

  /**
   * Suggest better unit for scaled amounts
   */
  static suggestBetterUnit(amount: number, currentUnit: string): { amount: number; unit: string } {
    const unit = currentUnit.toLowerCase();
    
    // Volume unit suggestions
    if (['ml', 'l'].includes(unit)) {
      if (amount >= 1000 && unit === 'ml') {
        return { amount: amount / 1000, unit: 'l' };
      }
      if (amount < 1 && unit === 'l') {
        return { amount: amount * 1000, unit: 'ml' };
      }
    }
    
    if (['tsp', 'tbsp', 'cup'].includes(unit)) {
      if (amount >= 3 && unit === 'tsp') {
        return { amount: amount / 3, unit: 'tbsp' };
      }
      if (amount >= 16 && unit === 'tbsp') {
        return { amount: amount / 16, unit: 'cup' };
      }
      if (amount < 1 && unit === 'tbsp') {
        return { amount: amount * 3, unit: 'tsp' };
      }
      if (amount < 0.25 && unit === 'cup') {
        return { amount: amount * 16, unit: 'tbsp' };
      }
    }
    
    // Weight unit suggestions
    if (['g', 'kg'].includes(unit)) {
      if (amount >= 1000 && unit === 'g') {
        return { amount: amount / 1000, unit: 'kg' };
      }
      if (amount < 1 && unit === 'kg') {
        return { amount: amount * 1000, unit: 'g' };
      }
    }
    
    if (['oz', 'lb'].includes(unit)) {
      if (amount >= 16 && unit === 'oz') {
        return { amount: amount / 16, unit: 'lb' };
      }
      if (amount < 1 && unit === 'lb') {
        return { amount: amount * 16, unit: 'oz' };
      }
    }
    
    return { amount, unit: currentUnit };
  }

  /**
   * Round amounts to reasonable precision based on unit type
   */
  private static roundToReasonablePrecision(amount: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    
    // For very small amounts, use more precision
    if (amount < 0.1) {
      return this.roundToDecimal(amount, 3);
    }
    
    // For spice measurements (tsp, pinch, etc.), use quarter precision
    if (['tsp', 'teaspoon', 'pinch', 'dash'].includes(unitLower)) {
      return Math.round(amount * 4) / 4;
    }
    
    // For tablespoons, use half precision
    if (['tbsp', 'tablespoon'].includes(unitLower)) {
      return Math.round(amount * 2) / 2;
    }
    
    // For cups and larger volumes, use quarter precision
    if (['cup', 'cups', 'l', 'liter', 'litre'].includes(unitLower)) {
      return Math.round(amount * 4) / 4;
    }
    
    // For weights, round to reasonable precision
    if (['g', 'gram', 'grams'].includes(unitLower)) {
      if (amount < 10) return this.roundToDecimal(amount, 1);
      return Math.round(amount);
    }
    
    if (['kg', 'kilogram', 'kilograms'].includes(unitLower)) {
      return this.roundToDecimal(amount, 2);
    }
    
    if (['oz', 'ounce', 'ounces'].includes(unitLower)) {
      return this.roundToDecimal(amount, 1);
    }
    
    if (['lb', 'pound', 'pounds'].includes(unitLower)) {
      return this.roundToDecimal(amount, 2);
    }
    
    // For counts (pieces, items, etc.), round to whole numbers
    if (['piece', 'pieces', 'item', 'items', 'whole', 'each'].includes(unitLower) || !unitLower) {
      return Math.round(amount);
    }
    
    // Default: round to 1 decimal place
    return this.roundToDecimal(amount, 1);
  }

  /**
   * Round number to specified decimal places
   */
  private static roundToDecimal(num: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  /**
   * Scale nutrient object (vitamins/minerals)
   */
  private static scaleNutrientObject(nutrients: Record<string, number>, scaleFactor: number): Record<string, number> {
    const scaled: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(nutrients)) {
      if (typeof value === 'number') {
        scaled[key] = this.roundToDecimal(value * scaleFactor, 1);
      }
    }
    
    return scaled;
  }

  /**
   * Calculate total recipe cost scaling (if cost data available)
   */
  static scaleCost(originalCost: number, originalServings: number, newServings: number): number {
    // Cost scales linearly with ingredients
    const scaleFactor = newServings / originalServings;
    return this.roundToDecimal(originalCost * scaleFactor, 2);
  }

  /**
   * Estimate equipment needs based on serving size
   */
  static getEquipmentRecommendations(servings: number): string[] {
    const recommendations: string[] = [];
    
    if (servings <= 2) {
      recommendations.push('Small saucepan', 'Small mixing bowl');
    } else if (servings <= 4) {
      recommendations.push('Medium saucepan', 'Medium mixing bowl');
    } else if (servings <= 8) {
      recommendations.push('Large saucepan', 'Large mixing bowl', 'Consider using a large skillet');
    } else {
      recommendations.push('Extra large pot', 'Multiple mixing bowls', 'Consider batch cooking');
    }
    
    return recommendations;
  }
}