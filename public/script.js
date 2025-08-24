// Frontend logic for AI Recipe App

document.addEventListener('DOMContentLoaded', () => {
  // Tab and panel handling
  const tabSearch = document.getElementById('tab-search');
  const tabRecipes = document.getElementById('tab-recipes');
  const tabPreferences = document.getElementById('tab-preferences');
  const tabHealth = document.getElementById('tab-health');

  const panelSearch = document.getElementById('panel-search');
  const panelRecipes = document.getElementById('panel-recipes');
  const panelPreferences = document.getElementById('panel-preferences');
  const panelHealth = document.getElementById('panel-health');

  function showPanel(panel) {
    [panelSearch, panelRecipes, panelPreferences, panelHealth].forEach(p => {
      if (p === panel) {
        p.classList.remove('hidden');
      } else {
        p.classList.add('hidden');
      }
    });
    // update active tab classes
    [tabSearch, tabRecipes, tabPreferences, tabHealth].forEach(t => {
      t.classList.toggle('active', t.dataset.panel === panel.id);
    });
  }

  tabSearch.addEventListener('click', () => showPanel(panelSearch));
  tabRecipes.addEventListener('click', () => showPanel(panelRecipes));
  tabPreferences.addEventListener('click', () => showPanel(panelPreferences));
  tabHealth.addEventListener('click', () => showPanel(panelHealth));

  // Elements
  const dietaryContainer = document.getElementById('dietary-options');
  const ingredientsInput = document.getElementById('ingredients-input');
  const servingSizeIng = document.getElementById('serving-size-ing');
  const searchIngredientsBtn = document.getElementById('search-ingredients-btn');
  const foodNameInput = document.getElementById('food-name-input');
  const servingSizeName = document.getElementById('serving-size-name');
  const searchNameBtn = document.getElementById('search-name-btn');
  const resultsContainer = document.getElementById('results-container');
  const recipeDetails = document.getElementById('recipe-details');
  const searchQuery = document.getElementById('search-query');
  const searchBtn = document.getElementById('search-btn');
  const popularLimit = document.getElementById('popular-limit');
  const popularBtn = document.getElementById('popular-btn');

  const preferencesBody = document.getElementById('preferences-body');
  const savePreferencesBtn = document.getElementById('save-preferences-btn');
  const updatePreferencesBtn = document.getElementById('update-preferences-btn');
  const prefUserId = document.getElementById('pref-user-id');
  const preferencesUpdateBody = document.getElementById('preferences-update-body');
  const preferencesResult = document.getElementById('preferences-result');
  const checkUserId = document.getElementById('check-user-id');
  const restrictionSelect = document.getElementById('restriction-select');
  const checkRestrictionBtn = document.getElementById('check-restriction-btn');
  const getPreferencesBtn = document.getElementById('get-preferences-btn');
  const deletePreferencesBtn = document.getElementById('delete-preferences-btn');

  const userIdGet = document.getElementById('user-id-get');

  const healthBtn = document.getElementById('health-btn');
  const configBtn = document.getElementById('config-btn');
  const healthResult = document.getElementById('health-result');

  // Utility
  function showJSON(container, obj) {
    container.innerHTML = '<pre>' + JSON.stringify(obj, null, 2) + '</pre>';
  }

  function getSelectedRestrictions() {
    return Array.from(dietaryContainer.querySelectorAll('input[type=checkbox]:checked'))
      .map(el => el.value);
  }

  // Load dietary restrictions and populate both the checkbox list and the select
  fetch('/api/preferences/dietary-restrictions')
    .then(res => res.json())
    .then(json => {
      if (json.success && Array.isArray(json.data)) {
        dietaryContainer.innerHTML = '';
        restrictionSelect.innerHTML = '<option value="">--select restriction--</option>';
        json.data.forEach(opt => {
          // checkbox
          const label = document.createElement('label');
          label.className = 'pill';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = opt.value;
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' ' + opt.label));
          dietaryContainer.appendChild(label);

          // select option
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          restrictionSelect.appendChild(option);
        });
      } else {
        dietaryContainer.textContent = 'Failed to load restrictions';
      }
    })
    .catch(err => {
      dietaryContainer.textContent = 'Error loading restrictions';
      console.error(err);
    });

  // Display helpers
  function displaySuggestions(title, suggestions) {
    resultsContainer.innerHTML = '';
    const heading = document.createElement('h3');
    heading.textContent = title;
    resultsContainer.appendChild(heading);

    const list = document.createElement('ul');
    suggestions.forEach((s) => {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = s.name || s.title || 'Unnamed';
      const desc = document.createElement('p');
      desc.textContent = s.description || s.brief || '';
      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'View Details';
      viewBtn.addEventListener('click', () => viewDetails(s));
      item.appendChild(name);
      item.appendChild(desc);
      item.appendChild(viewBtn);
      list.appendChild(item);
    });
    resultsContainer.appendChild(list);
    showPanel(panelRecipes);
  }

  function displayDetails(recipe) {
    recipeDetails.innerHTML = '';
    if (!recipe) {
      recipeDetails.textContent = 'No recipe data';
      return;
    }

    const title = document.createElement('h3');
    title.textContent = recipe.name || recipe.title || 'Recipe';
    recipeDetails.appendChild(title);

    if (recipe.description) {
      const p = document.createElement('p');
      p.textContent = recipe.description;
      recipeDetails.appendChild(p);
    }

    const servingDiv = document.createElement('div');
    servingDiv.className = 'row';
    servingDiv.innerHTML = `
      <label>Serving Size: <input id="detail-serving-size" type="number" min="1" value="${recipe.servingSize || 1}" /></label>
      <button id="scale-btn">Scale</button>
      <button id="substitute-btn">Suggest Substitutes</button>
    `;
    recipeDetails.appendChild(servingDiv);

    // Scale handler
    recipeDetails.querySelector('#scale-btn').addEventListener('click', () => {
      const newSize = parseInt(recipeDetails.querySelector('#detail-serving-size').value, 10) || recipe.servingSize || 1;
      const id = recipe.id || recipe.recipeId;
      if (!id) {
        recipeDetails.innerHTML = '<pre>Cannot scale: missing recipe id</pre>';
        return;
      }

      fetch(`/api/recipes/${encodeURIComponent(id)}/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: id, newServingSize: newSize })
      })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            displayDetails(json.data);
          } else {
            showJSON(recipeDetails, json);
          }
        })
        .catch(err => showJSON(recipeDetails, { error: err.message || err }));
    });

    // Substitute handler
    recipeDetails.querySelector('#substitute-btn').addEventListener('click', () => {
      const ingredient = prompt('Ingredient to substitute (e.g. milk):');
      if (!ingredient) return;
      const restrictions = getSelectedRestrictions();
      const context = recipe.description || recipe.instructions?.join(' ') || '';
      fetch(`/api/recipes/${encodeURIComponent(recipe.id || recipe.recipeId)}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient, dietaryRestrictions: restrictions, recipeContext: context })
      })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            showJSON(recipeDetails, json.data);
          } else {
            showJSON(recipeDetails, json);
          }
        })
        .catch(err => showJSON(recipeDetails, { error: err.message || err }));
    });

    // Ingredients
    if (Array.isArray(recipe.ingredients)) {
      const ingHeader = document.createElement('h4');
      ingHeader.textContent = 'Ingredients';
      recipeDetails.appendChild(ingHeader);
      const ul = document.createElement('ul');
      recipe.ingredients.forEach(i => {
        const li = document.createElement('li');
        const amount = i.amount ?? '';
        const unit = i.unit ?? '';
        li.textContent = `${amount} ${unit} ${i.name || i.ingredient || ''}`.trim();
        ul.appendChild(li);
      });
      recipeDetails.appendChild(ul);
    }

    // Instructions
    if (Array.isArray(recipe.instructions)) {
      const instHeader = document.createElement('h4');
      instHeader.textContent = 'Instructions';
      recipeDetails.appendChild(instHeader);
      const ol = document.createElement('ol');
      recipe.instructions.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        ol.appendChild(li);
      });
      recipeDetails.appendChild(ol);
    }

    // Nutrition
    if (recipe.nutritionalInfo) {
      const nutHeader = document.createElement('h4');
      nutHeader.textContent = 'Nutritional Info';
      recipeDetails.appendChild(nutHeader);
      showJSON(recipeDetails, recipe.nutritionalInfo);
    }
  }

  function viewDetails(suggestion) {
    // If suggestion already has detailed fields, show them
    if (suggestion.instructions || suggestion.ingredients) {
      displayDetails(suggestion);
      return;
    }

    // Otherwise create-detailed (POST /api/recipes/create-detailed)
    fetch('/api/recipes/create-detailed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestion })
    })
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          displayDetails(json.data);
        } else {
          showJSON(recipeDetails, json);
        }
      })
      .catch(err => showJSON(recipeDetails, { error: err.message || err }));
  }

  function displayResults(title, data) {
    resultsContainer.innerHTML = '';
    const heading = document.createElement('h3');
    heading.textContent = title;
    resultsContainer.appendChild(heading);
    showJSON(resultsContainer, data);
    showPanel(panelRecipes);
  }

  // Search by ingredients
  searchIngredientsBtn.addEventListener('click', () => {
    const ingredients = ingredientsInput.value.split(',').map(s => s.trim()).filter(Boolean);
    const servingSize = parseInt(servingSizeIng.value, 10) || 1;
    const dietaryRestrictions = getSelectedRestrictions();

    fetch('/api/recipes/by-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, dietaryRestrictions, servingSize })
    })
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          displaySuggestions('Recipes by Ingredients', json.data);
        } else {
          displayResults('Error', json);
        }
      })
      .catch(err => displayResults('Error', { error: err.message || err }));
  });

  // Search by name
  searchNameBtn.addEventListener('click', () => {
    const foodName = foodNameInput.value.trim();
    const servingSize = parseInt(servingSizeName.value, 10) || 1;
    const dietaryRestrictions = getSelectedRestrictions();

    fetch('/api/recipes/by-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodName, dietaryRestrictions, servingSize })
    })
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          displaySuggestions('Recipe Variations', json.data);
        } else {
          displayResults('Error', json);
        }
      })
      .catch(err => displayResults('Error', { error: err.message || err }));
  });

  // Free text search (GET /api/recipes/search?q=)
  searchBtn.addEventListener('click', () => {
    const q = (searchQuery.value || '').trim();
    if (!q) {
      displayResults('Error', { error: 'Query required' });
      return;
    }
    const restrictions = getSelectedRestrictions();
    const params = new URLSearchParams();
    params.set('q', q);
    if (restrictions.length) params.set('dietaryRestrictions', restrictions.join(','));

    fetch(`/api/recipes/search?${params.toString()}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          displaySuggestions(`Search: ${q}`, json.data);
        } else {
          displayResults('Error', json);
        }
      })
      .catch(err => displayResults('Error', { error: err.message || err }));
  });

  // Popular recipes
  popularBtn.addEventListener('click', () => {
    const limit = parseInt(popularLimit.value, 10) || 10;
    const restrictions = getSelectedRestrictions();
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (restrictions.length) params.set('dietaryRestrictions', restrictions.join(','));

    fetch(`/api/recipes/popular?${params.toString()}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          displaySuggestions('Popular Recipes', json.data);
        } else {
          displayResults('Error', json);
        }
      })
      .catch(err => displayResults('Error', { error: err.message || err }));
  });

  // Preferences CRUD
  savePreferencesBtn.addEventListener('click', () => {
    try {
      const body = JSON.parse(preferencesBody.value);
      fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(res => res.json())
        .then(json => {
          showJSON(preferencesResult, json);
        })
        .catch(err => showJSON(preferencesResult, { error: err.message || err }));
    } catch (err) {
      showJSON(preferencesResult, { error: 'Invalid JSON' });
    }
  });

  updatePreferencesBtn.addEventListener('click', () => {
    const userId = (prefUserId.value || '').trim();
    if (!userId) {
      showJSON(preferencesResult, { error: 'User ID required' });
      return;
    }
    try {
      const body = JSON.parse(preferencesUpdateBody.value);
      fetch(`/api/preferences/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(res => res.json())
        .then(json => showJSON(preferencesResult, json))
        .catch(err => showJSON(preferencesResult, { error: err.message || err }));
    } catch (err) {
      showJSON(preferencesResult, { error: 'Invalid JSON' });
    }
  });

  getPreferencesBtn.addEventListener('click', () => {
    const userId = (userIdGet.value || '').trim() || (prefUserId.value || '').trim();
    if (!userId) {
      showJSON(preferencesResult, { error: 'User ID required' });
      return;
    }
    fetch(`/api/preferences/${encodeURIComponent(userId)}`)
      .then(res => res.json())
      .then(json => showJSON(preferencesResult, json))
      .catch(err => showJSON(preferencesResult, { error: err.message || err }));
  });

  deletePreferencesBtn.addEventListener('click', () => {
    const userId = (userIdGet.value || '').trim() || (prefUserId.value || '').trim();
    if (!userId) {
      showJSON(preferencesResult, { error: 'User ID required' });
      return;
    }
    fetch(`/api/preferences/${encodeURIComponent(userId)}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(json => showJSON(preferencesResult, json))
      .catch(err => showJSON(preferencesResult, { error: err.message || err }));
  });

  checkRestrictionBtn.addEventListener('click', () => {
    const userId = (checkUserId.value || '').trim();
    const restriction = (restrictionSelect.value || '').trim();
    if (!userId || !restriction) {
      showJSON(preferencesResult, { error: 'User ID and restriction required' });
      return;
    }
    fetch(`/api/preferences/${encodeURIComponent(userId)}/check-restriction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restriction })
    })
      .then(res => res.json())
      .then(json => showJSON(preferencesResult, json))
      .catch(err => showJSON(preferencesResult, { error: err.message || err }));
  });

  // Health & config
  healthBtn.addEventListener('click', () => {
    fetch('/api/health').then(res => res.json()).then(json => showJSON(healthResult, json)).catch(err => showJSON(healthResult, { error: err.message || err }));
  });
  configBtn.addEventListener('click', () => {
    fetch('/api/health/config').then(res => res.json()).then(json => showJSON(healthResult, json)).catch(err => showJSON(healthResult, { error: err.message || err }));
  });

  // Start on search panel
  showPanel(panelSearch);
});