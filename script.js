let currentCategory = "";

function selectCategory(category){

    currentCategory = category;

    const filter = document.getElementById("filterContainer");

    switch(category){

        case "Weapons":

            filter.innerHTML = `

                <h4>Weapons Filter</h4>

                <p>이름</p>

                <p>탄약 종류</p>

                <p>슬롯</p>

                <p>가격</p>

                <p>데미지</p>

                <p>탄속</p>

                <p>유효 사거리</p>

                <p>연사속도</p>

                <p>장전시간</p>

            `;

            break;

        case "Tools":

            filter.innerHTML = `

                <h4>Tools Filter</h4>

                <p>이름</p>

                <p>가격</p>

            `;

            break;

        case "Consumables":

            filter.innerHTML = `

                <h4>Consumables Filter</h4>

                <p>이름</p>

                <p>가격</p>

            `;

            break;

        case "Traits":

            filter.innerHTML = `

                <h4>Traits Filter</h4>

                <p>이름</p>

                <p>포인트</p>

            `;

            break;

    }

    document.getElementById("result").innerHTML =

        `<h2>${category}</h2>
         <p>데이터 준비 중...</p>`;

}

function searchData(){

    const keyword = document.getElementById("searchInput").value;

    document.getElementById("result").innerHTML =

    `
    <h2>검색</h2>

    <p>검색어 : ${keyword}</p>

    <p>(아직 데이터 연결 전)</p>

    `;

}
