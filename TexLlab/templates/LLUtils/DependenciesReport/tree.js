/**
 * Dati da disegnare nell'albero sotto forma di oggetto
 * @param {*} treeData 
 */
function drawData(treeData) {
	// set the dimensions and margins of the diagram
	// faccio questo calcolo strano per stabilire il margine da sinistra guardando la lunghezza del nome della POU
	const margin = { top: 10, right: 215, bottom: 10, left: treeData.name.length * 9 },
		width = treeView.offsetWidth - margin.left - margin.right,
		height = treeView.offsetHeight - margin.top - margin.bottom;

	// declares a tree layout and assigns the size
	let treemap = d3.tree().size([height, width]);

	//  assigns the data to a hierarchy using parent-child relationships
	let nodes = d3.hierarchy(treeData, d => d.children);

	// maps the node data to the tree layout
	nodes = treemap(nodes);

    var descendantNodes = nodes.descendants();

	// raggruppo i nodi per livello di profondita' per capire quale occupera' piu' spazio verticale
    let nodeMap = {}
    descendantNodes.forEach(element => {
        if (!nodeMap[element.depth])
            nodeMap[element.depth] = [];

        nodeMap[element.depth].push(element);
    });

    let hightest = 0;
    for (let key in nodeMap) {
        let items = nodeMap[key];
        if (items.length > hightest)
            hightest = items.length;
    }

	let destHeight = height;

	// oltre i 10 nodi verticali sovrapposti applica un diverso sistema per calcolare l'altezza totale dell'albero
	const STANDARD_HEIGHT_LIMIT = 10;
	if (hightest > STANDARD_HEIGHT_LIMIT) {
		// fattore moltiplicativo per lasciare piu' margine verticale tra i nodi
		const MULTIPLY_FACTOR = 1.25;

		// fisso una grandezza che dovranno avere i nodi
		const nodeSize = [30, 190];

		// calcola una nuova altezza che e' basata sulla dimensione dei nodi e non piu' su quella della pagina, cosi' permette al grafico di scrollare
		destHeight = nodeSize[0] * hightest * MULTIPLY_FACTOR;

		// ridichiara il nodo specificando una nuova size
		treemap = d3.tree().size([destHeight, width]);

		// ridichiara i nodes con la nuova altezza
		nodes = treemap(nodes);
	}

	// append the svg object to the body of the page
	// appends a 'group' element to 'svg'
	// moves the 'group' element to the top left margin
	const svg = d3.select("#treeView").append("svg")
		.attr("width", width - margin.left - margin.right)
		.attr("height", destHeight - margin.top - margin.bottom),
		g = svg.append("g")
			.attr("transform",
				"translate(" + margin.left + "," + margin.top + ")");


	// adds the links between the nodes
	const link = g.selectAll(".link")
		.data(nodes.descendants().slice(1))
		.enter().append("path")
		.attr("class", "link")
		.style("stroke", d => d.data.level)
		.attr("d", d => {
			return "M" + d.y + "," + d.x
				+ "C" + (d.y + d.parent.y) / 2 + "," + d.x
				+ " " + (d.y + d.parent.y) / 2 + "," + d.parent.x
				+ " " + d.parent.y + "," + d.parent.x;
		});

	// adds each node as a group
	const node = g.selectAll(".node")
		.data(nodes.descendants())
		.enter().append("g")
		.attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
		.attr("transform", d => "translate(" + d.y + "," + d.x + ")");

	// adds the circle to the node
	node.append("circle")
		.attr("r", d => d.data.value)
		.style("stroke", d => d.data.type)
		.style("fill", d => d.data.level);

	// adds the text to the node
	node.append("text")
		.attr("dy", ".35em")
		.attr("x", d => d.children ? (d.data.value + 5) * -1 : d.data.value + 5)
		.attr("y", d => d.children && d.depth !== 0 ? -(d.data.value + 5) : d)
		.style("text-anchor", d => d.children ? "end" : "start")
		.text(d => d.data.name);

	// workaround per disinguere l'evento di singolo click da quello di doppio click
	// se ci fossero i due eventi distinti click e dblcick, il click verrebbe triggerato immediatamente non dando la possibilita' al dblclick di avvenire
	// spunto: https://stackoverflow.com/a/26296759/3352304
	var m_clickNum = 0;
	node.on("click", el => {
		m_clickNum++;
		setTimeout(() => {
			let SID = el.data._SID;

			if (m_clickNum == 1) {
				// seleziona la POU cliccata
				if(SID)
					NodeClick(SID);
			}
			else if (m_clickNum == 2) {
				// naviga alla definizione
				if(SID)
					app.CallFunction("logiclab.GoToPLCLink", SID);
			}

			m_clickNum = 0;
		}, 300);
	});
}