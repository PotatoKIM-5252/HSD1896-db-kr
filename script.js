let currentCategory = null;

const categoryTitle = document.getElementById("categoryTitle");
const filters = document.getElementById("filters");
const results = document.getElementById("results");

document.querySelectorAll("nav button").forEach(button => {

    button.addEventListener("click", () => {

        selectCategory(button.dataset.category);

    });

});

document.getElementById("searchButton").addEventListener("click", search);

function selectCategory(category) {

    currentCategory = category;

    switch (category) {

        case "weapons":

            categoryTitle.textContent = "Weapons";

            filters.innerHTML = `
                <p>무기 이름</p>
                <p>탄약 종류</p>
                <p>슬롯</p>
                <p>가격</p>
                <p>데미지</p>
                <p>탄속</p>
                <p>유효 사거리</p>
            `;

            break;

        case "tools":

            categoryTitle.textContent = "Tools";

            filters.innerHTML = `
                <p>이름</p>
                <p>가격</p>
            `;

            break;

        case "consumables":

            categoryTitle.textContent = "Consumables";

            filters.innerHTML = `
                <p>이름</p>
                <p>가격</p>
            `;

            break;

        case "traits":

            categoryTitle.textContent = "Traits";

            filters.innerHTML = `
                <p>이름</p>
                <p>포인트</p>
            `;

            break;

    }

    results.innerHTML = `
        <h3>${categoryTitle.textContent}</h3>
        <p>데이터 준비 중...</p>
    `;

}

function search() {

    const keyword = document.getElementById("searchInput").value.trim();

    if (keyword === "") {

        alert("검색어를 입력하세요.");

        return;

    }

    results.innerHTML = `
        <h3>검색</h3>
        <p>검색어 : <strong>${keyword}</strong></p>
        <p>아직 데이터가 연결되지 않았습니다.</p>
    `;

}
