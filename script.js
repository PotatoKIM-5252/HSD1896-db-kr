let currentCategory = "";

const listPanel = document.getElementById("listPanel");
const detailPanel = document.getElementById("detailPanel");
const filters = document.getElementById("filters");

document.querySelectorAll("#mainMenu button").forEach(button=>{

    button.addEventListener("click",()=>{

        currentCategory = button.dataset.category;

        createFilter(currentCategory);

        loadCategory(currentCategory);

    });

});

function createFilter(category){

    switch(category){

        case "weapons":

            filters.innerHTML=`

<h3>Weapon Filter</h3>

<label>탄약</label>

<select>

<option>전체</option>

<option>Compact</option>

<option>Medium</option>

<option>Long</option>

<option>Shotgun</option>

<option>Special</option>

</select>

<label>슬롯</label>

<select>

<option>전체</option>

<option>1 Slot</option>

<option>2 Slot</option>

<option>3 Slot</option>

</select>

<label>가격</label>

<input type="number" placeholder="Min">

<input type="number" placeholder="Max">

<label>탄속</label>

<input type="number" placeholder="Min">

<input type="number" placeholder="Max">

<label>데미지</label>

<input type="number" placeholder="Min">

<input type="number" placeholder="Max">

`;

        break;

        case "tools":

            filters.innerHTML="<h3>Tools Filter</h3>";

        break;

        case "consumables":

            filters.innerHTML="<h3>Consumables Filter</h3>";

        break;

        case "traits":

            filters.innerHTML="<h3>Traits Filter</h3>";

        break;

    }

}

function loadCategory(category){

    listPanel.innerHTML="";

    detailPanel.innerHTML=`
<h2>${category}</h2>
<p>데이터 준비중...</p>
`;

}

document.getElementById("searchButton").addEventListener("click",search);

function search(){

    const keyword=document.getElementById("searchInput").value;

    detailPanel.innerHTML=`

<h2>검색</h2>

<p>${keyword}</p>

`;

}
