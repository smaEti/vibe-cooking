// Frontend logic for AI Recipe App

document.addEventListener('DOMContentLoaded', () => {
  const dietaryContainer = document.getElementById('dietary-options');
  const ingredientsInput = document.getElementById('ingredients-input');
  const servingSizeIng = document.getElementById('serving-size-ing');
  const searchIngredientsBtn = document.getElementById('search-ingredients-btn');
  const foodNameInput = document.getElementById('food-name-input');
  const servingSizeName = document.getElementById('serving-size-name');
  const searchNameBtn = document.getElementById('search-name-btn');
  const resultsContainer = document.getElementById('results-container');

  // Load dietary restriction options
  fetch('/api/preferences/dietary-restrictions')
    .then(res => res.json())
    .then(json => {
      if (json.success && Array.isArray(json.data)) {
        json.data.forEach(opt => {
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = opt.value;
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' ' + opt.label));
          dietaryContainer.appendChild(label);
        });
      }
    })
    .catch(err => console.error('Failed to load dietary restrictions:', err));

  // Helper to get selected restrictions
  function getSelectedRestrictions() {
    return Array.from(dietaryContainer.querySelectorAll('input[type=checkbox]:checked'))
      .map(el => el.value);
  }

  // Display suggestions with clickable details
  function displaySuggestions(title, suggestions) {
    resultsContainer.innerHTML = '';
    const heading = document.createElement('h3');
    heading.textContent = title;
    resultsContainer.appendChild(heading);

    const list = document.createElement('ul');
    suggestions.forEach((s) => {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = s.name;
      const desc = document.createElement('p');
      desc.textContent = s.description;
      const button = document.createElement('button');
      button.textContent = 'View Details';
      button.addEventListener('click', () => viewDetails(s));
      item.appendChild(name);
      item.appendChild(desc);
      item.appendChild(button);
      list.appendChild(item);
    });
    resultsContainer.appendChild(list);
  }

  // View details of a suggestion
  function viewDetails(suggestion) {
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
          displayDetails(json);
        }
      })
      .catch(err => displayDetails({ error: 'Error fetching details', details: err }));
  }

  // Display detailed recipe
  function displayDetails(recipe) {
      const detailsContainer = document.getElementById('recipe-details');
      detailsContainer.innerHTML = '';
  
      // Title and description
      const title = document.createElement('h3');
      title.textContent = recipe.name;
      detailsContainer.appendChild(title);
  
      if (recipe.description) {
        const desc = document.createElement('p');
        desc.textContent = recipe.description;
        detailsContainer.appendChild(desc);
      }
  
      // Serving size selector
      const servingDiv = document.createElement('div');
      servingDiv.innerHTML = \`
        <label>Serving Size: <input id="detail-serving-size" type="number" min="1" value="\${recipe.servingSize}" /></label>
        <button id="scale-btn">Scale</button>
      \`;
      detailsContainer.appendChild(servingDiv);
  
      document.getElementById('scale-btn').addEventListener('click', () => {
        const newSize = parseInt((document.getElementById('detail-serving-size')).value, 10) || recipe.servingSize;
        fetch(\`/api/recipes/\${recipe.id}/scale\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newServingSize: newSize })
        })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            displayDetails(json.data);
          } else {
            detailsContainer.innerHTML = '<pre>' + JSON.stringify(json, null, 2) + '</pre>';
          }
        })
        .catch(err => {
          detailsContainer.innerHTML = '<pre>' + JSON.stringify(err, null, 2) + '</pre>';
        });
      });
  
      // Ingredients list
      const ingHeader = document.createElement('h4');
      ingHeader.textContent = 'Ingredients';
      detailsContainer.appendChild(ingHeader);
  
      const ulIng = document.createElement('ul');
      recipe.ingredients.forEach((i) => {
        const li = document.createElement('li');
        li.textContent = \`\${i.amount} \${i.unit} \${i.name}\`;
        ulIng.appendChild(li);
      });
      detailsContainer.appendChild(ulIng);
  
      // Instructions list
      const instHeader = document.createElement('h4');
      instHeader.textContent = 'Instructions';
      detailsContainer.appendChild(instHeader);
  
      const olInst = document.createElement('ol');
      recipe.instructions.forEach((step) => {
        const li = document.createElement('li');
        li.textContent = step;
        olInst.appendChild(li);
      });
      detailsContainer.appendChild(olInst);
  
      // Nutritional information
      if (recipe.nutritionalInfo) {
        const nutHeader = document.createElement('h4');
        nutHeader.textContent = 'Nutritional Information';
        detailsContainer.appendChild(nutHeader);
  
        const preNut = document.createElement('pre');
        preNut.textContent = JSON.stringify(recipe.nutritionalInfo, null, 2);
        detailsContainer.appendChild(preNut);
      }
  }

  // Display results in the results container
  function displayResults(title, data) {
    resultsContainer.innerHTML = '';
    const heading = document.createElement('h3');
    heading.textContent = title;
    resultsContainer.appendChild(heading);

    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    resultsContainer.appendChild(pre);
  }

  // Search by ingredients
  searchIngredientsBtn.addEventListener('click', () => {
    const ingredients = ingredientsInput.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
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
      .catch(err => displayResults('Error fetching recipes', err));
  });

  // Search by food name
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
      .catch(err => displayResults('Error fetching variations', err));
  });
});