var app = window.external;
var gentypes = app.CallFunction("common.GetGeneralTypes");
var genfuncs = app.CallFunction("common.GetGeneralFunctions");

function InitPage()
{
	var path = _DATAPATH
	var masterNode = app.SelectNodesXML(path + ".")[0];

	if (!genfuncs.ParseBoolean((masterNode.getAttribute("enabled"))))
	{
		var row = summaryTable.insertRow(-1);
		var indexCell = row.insertCell(0);
		indexCell.innerHTML = app.Translate("MQTT disabled");

		return;
	}
   


	var nodelist = app.SelectNodesXML(path + "/./" + m_nodeName + "/brokerMapping");
	if (nodelist.length == 0)
	{
		var row = summaryTable.insertRow(-1);
		var indexCell = row.insertCell(0);
		indexCell.innerHTML = app.Translate("No broker defined for") + " " + (m_nodeName == "subscribe" ? app.Translate("subscription") : app.Translate("publishing"));

		return;
	}
   
	var index = 0;

	// aggiunta header broker name e #
	var headerCell = document.createElement("TH");
	headerCell.innerHTML = app.Translate("#");
	tableHeader.appendChild(headerCell);

	headerCell = document.createElement("TH");
	headerCell.innerHTML = app.Translate("Broker name");
	tableHeader.appendChild(headerCell);

	for (var i = 0; i < m_columnsDefinition.length; i++)
	{
		var headerCell = document.createElement("TH");
		headerCell.innerHTML = m_columnsDefinition[i].name;
		tableHeader.appendChild(headerCell);
	}   

	var prevClassName;
	var node;
	var prevParentNode;

	while (node = nodelist.nextNode())
	{
		if (!genfuncs.ParseBoolean(node.selectSingleNode("..//..").getAttribute("enabled")))
			continue;

		var colIndex = 0;
		var row = summaryTable.insertRow(-1);
		var indexCell = row.insertCell(colIndex++);
		indexCell.innerHTML = ++index;       

		var brokerName = node.selectSingleNode("..//..").getAttribute("caption");
		var brokerNameCell = row.insertCell(colIndex++);
		brokerNameCell.innerHTML = brokerName;

		// background alternato delle righe (quando cambia il parent node)
		if (node.parentNode != prevParentNode)
		{
			// utilizzo classe bootstrap
			row.className = prevClassName == "" ? "active" : ""
			prevClassName = row.className;
			prevParentNode = node.parentNode;
		}


		for (var i = 0; i < m_columnsDefinition.length; i++)
		{
			var recordCell = row.insertCell(colIndex++);

			if (m_columnsDefinition[i].attr === "variable")
			{
				var value = node.getAttribute(m_columnsDefinition[i].attr);

				// ottengo la lista di variabili mappate per il topic corrente
				let varList = [];
				var mappingNodes = node.selectNodes("brokerField");
				var mappingNode;
				while (mappingNode = mappingNodes.nextNode())
				{
					var varName = mappingNode.getAttribute("value");
					if (varName)
						varList.push(varName);
				}

				var value = varList.join(", ");
			}
			else
			{
				var value = node.getAttribute(m_columnsDefinition[i].attr);
				if (m_columnsDefinition[i].bool)
					value = value == 0 ? "false" : "true"
			}

			recordCell.innerText = value;
		}
	}
}

