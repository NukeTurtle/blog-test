// Initialize ag-Grid
document.addEventListener('DOMContentLoaded', function () {
    const gridDiv = document.querySelector('#agGrid');
    const gridOptions = {
        columnDefs: [
            { headerName: 'Title', field: 'postTitle', filter: 'agTextColumnFilter', sortable: true, width: 30 },
            { headerName: 'Description', field: 'postDescription', filter: 'agTextColumnFilter', sortable: true, width: 70 },
        ],
        defaultColDef: {
            flex: 1,
            minWidth: 20,
            resizable: true,
        },
        suppressRowClickSelection: true,
        rowSelection: 'multiple',
        domLayout: 'autoHeight',
        getRowStyle: (params) => {
            if (params.node.rowIndex % 2 === 0) {
                // Apply a different background color to even rows
                return { background: '#00000016' };
            }
            // Default style for odd rows
            return null;
        },
        onRowClicked: (event) => {
            if (event.node) {
                // Get the selected post ID from the row data (assuming you have an 'idposts' field)
                displaySelectedPost(event.data);
            }
        },
        onFirstDataRendered: onFirstDataRendered,
    };

    const grid = new agGrid.Grid(gridDiv, gridOptions);

    // Fetch data and load it into the grid
    fetchDataAndLoadGrid(gridOptions);

    gridOptions.api.addEventListener('rowClicked', function (event) {
        if (event.node) {
            displaySelectedPost(event.data);
        }
    });

    // Handle row click events to display selected post details
    gridOptions.api.addEventListener('firstDataRendered', function () {
        const firstNode = gridOptions.api.getDisplayedRowAtIndex(0);
        if (firstNode) {
            firstNode.setSelected(true);
            // Instead of dispatching a click event, directly call your displaySelectedPost function
            displaySelectedPost(firstNode.data);
        }
    });

    window.addEventListener('resize', () => {
        // Resize the columns to fit the new width
        gridOptions.api.sizeColumnsToFit();
    });
});

// Function to fetch data and load it into the grid
function fetchDataAndLoadGrid(gridOptions) {
    fetch('/api/posts')
        .then((response) => response.json())
        .then((data) => {
            gridOptions.api.setRowData(data.reverse());

            // Select the first row (latest post) after the data is loaded
            if (data.length > 0) {
                const latestPostId = data[0].idposts;
                gridOptions.api.forEachNode((node) => {
                    if (node.data.idposts === latestPostId) {
                        node.setSelected(true); // Select the latest post
                    }
                });
            }
        })
        .catch((error) => {
            console.error('Error fetching data:', error);
        });
}

function onFirstDataRendered(params) {
    // Auto-size columns to fit content after the first data render
    params.api.sizeColumnsToFit();
}

// Function to display selected post details
function displaySelectedPost(post) {
    const selectedPostDiv = document.getElementById('selectedPost');
    const inputDateString = post.postDate;
    const inputDate = new Date(inputDateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    const formattedDate = new Intl.DateTimeFormat('en-UK', options).format(inputDate);

    selectedPostDiv.classList.add("new-post");
    selectedPostDiv.innerHTML = `
        <img class="post-image" src="/uploads/${post.postImage}"</img>
        <hr>
        <h2>${post.postTitle}</h2>
        <p><b>Description:</b><br> ${post.postDescription}</p>
        <p><b>Content:</b> ${post.postContent}</p>
        <p><b>Published:</b><br>${formattedDate}</p>
    `;
}