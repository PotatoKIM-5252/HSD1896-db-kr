let currentCategory = "";

const listPanel = document.getElementById("listPanel");
const detailPanel = document.getElementById("detailPanel");
const filters = document.getElementById("filters");
const categoryTitle = document.getElementById("categoryTitle");

document.querySelectorAll("#mainMenu button").forEach(button => {

    button.addEventListener("click", () => {

        selectCategory(button.dataset.category);

    });

});

function selectCategory(category){

    switch(category){

        case "weapons":

            categoryTitle.textContent = "Weapons";

            filters.innerHTML = `

            <div class="filterGroup">

                <h3>Slot</h3>

                <button>1</button>
                <button>2</button>
                <button>3</button>
                <button>4</button>
                <button>5</button>

            </div>

            <div class="filterGroup">

                <h3>Ammo</h3>

                <button>Compact</button>
                <button>Medium</button>
                <button>Long</button>
                <button>Shotgun</button>
                <button>Special</button>

            </div>

            <div class="filterGroup">

                <h3>Special Ammo</h3>

                <button>Dumdum</button>
                <button>FMJ</button>
                <button>HV</button>
                <button>Incendiary</button>
                <button>Poison</button>
                <button>Spitzer</button>
                <button>Explosive</button>
                <button>Slug</button>
                <button>Penny Shot</button>
                <button>Dragon Breath</button>
                <button>Flechette</button>

            </div>

            `;

            break;

        case "tools":

            categoryTitle.textContent = "Tools";

            filters.innerHTML = `

            <div class="filterGroup">

                <h3>Tool Type</h3>

                <button>Healing</button>
                <button>Melee</button>
                <button>Trap</button>
                <button>Utility</button>

            </div>

            `;

            break;

        case "consumables":

            categoryTitle.textContent = "Consumables";

            filters.innerHTML = `

            <div class="filterGroup">

                <h3>Consumable Type</h3>

                <button>Health</button>
                <button>Explosive</button>
                <button>Fire</button>
                <button>Poison</button>
                <button>Utility</button>

            </div>

            `;

            break;

        case "traits":

            categoryTitle.textContent = "Traits";

            filters.innerHTML = `

            <div class="filterGroup">

                <h3>Trait Type</h3>

                <button>Offense</button>
                <button>Defense</button>
                <button>Movement</button>
                <button>Healing</button>
                <button>Utility</button>

            </div>

            `;

            break;

    }

    document.getElementById("listPanel").innerHTML =
    `<h3>${categoryTitle.textContent}</h3>
    <p>데이터 준비중...</p>`;

}
