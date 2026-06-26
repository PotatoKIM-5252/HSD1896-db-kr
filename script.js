let currentCategory = "";

function selectCategory(category){

    currentCategory = category;

    const filterArea = document.getElementById("filterArea");
    const listArea = document.getElementById("listArea");

    switch(category){

        case "weapons":

            filterArea.innerHTML = `

<h2>Weapons Filter</h2>

<b>Slot</b><br>

<button>1 Slot</button>
<button>2 Slot</button>
<button>3 Slot</button>
<button>4 Slot</button>
<button>5 Slot</button>

<br><br>

<b>Ammo</b><br>

<button>Compact</button>
<button>Medium</button>
<button>Long</button>
<button>Shotgun</button>
<button>Special</button>

<br><br>

<b>Special Ammo</b><br>

<button>Dumdum</button>
<button>FMJ</button>
<button>High Velocity</button>
<button>Incendiary</button>
<button>Poison</button>
<button>Spitzer</button>
<button>Explosive</button>
<button>Slug</button>
<button>Penny Shot</button>
<button>Dragon Breath</button>
<button>Flechette</button>

`;

            listArea.innerHTML = `
<h2>Weapons</h2>

<p>무기 목록이 여기에 표시됩니다.</p>
`;

        break;

        case "tools":

            filterArea.innerHTML = `

<h2>Tools Filter</h2>

<button>Healing</button>
<button>Melee</button>
<button>Trap</button>
<button>Utility</button>

`;

            listArea.innerHTML = `
<h2>Tools</h2>

<p>도구 목록</p>
`;

        break;

        case "consumables":

            filterArea.innerHTML = `

<h2>Consumables Filter</h2>

<button>Healing</button>
<button>Fire</button>
<button>Explosive</button>
<button>Poison</button>
<button>Utility</button>

`;

            listArea.innerHTML = `
<h2>Consumables</h2>

<p>소모품 목록</p>
`;

        break;

        case "traits":

            filterArea.innerHTML = `

<h2>Traits Filter</h2>

<button>Offense</button>
<button>Defense</button>
<button>Movement</button>
<button>Healing</button>
<button>Utility</button>

`;

            listArea.innerHTML = `
<h2>Traits</h2>

<p>특성 목록</p>
`;

        break;

    }

}

document.getElementById("searchButton").addEventListener("click", function(){

    const keyword = document.getElementById("searchInput").value;

    alert("검색 : " + keyword);

});
