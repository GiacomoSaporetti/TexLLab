function grid::ClickElem(row,col)
{
	grid.EditMode(true)
}

function grid::GetTextColor(row,col)
{
	if (row == gridErrorPos.row && col == gridErrorPos.col)
		grid.EventResult = 0x0000FF
}

function grid::GetEnum(row,col)
{
	if (col == columns.ctrlType)
	{
		// quando creo una nuova riga
		var item = grid.Elem(row, columns.name);
		if (!item)
		{
			grid.EventResult = "EmptyEnum";
			return;
		}

		var par = m_globalVarsMap[item];
		if (!par)
		{
			// variabile non trovata?
			grid.EventResult = "EmptyEnum";
			return;
		}

		if (par.Type.toUpperCase() == "BOOL")
		{
			// controlli supportati per il tipo BOOL
			grid.EventResult = "BoolEnum";
			return;
		}
		else if (par.Type.toUpperCase() in IECTypes)
		{
			// tipo standard: solo input text
			grid.EventResult = "TextOnlyEnum";
			return;
		}
		else
		{
			// tipo NON standard enumerativo
			// TODO bisognerebbe anche controllare che sia effettivamente un enum, si può arrivare qui anche con struct, fb, ...
			grid.EventResult = "EnumerativeEnum";
			return;
		}
	}
}

function grid::DblClickElem(row,col)
{
	// la funzione e' definita nell'altro JS
	if (col == columns.name)
		Assign();
}

function BuildPath(row,col)
{
	return gridDatapath + "/*[" + (row+1) + "]/" + m_columnsNodes[col]
}

function IsEnumControl(type)
{
	return type == HTMLCTRL.IMAGE || type == HTMLCTRL.BUTTON || type == HTMLCTRL.RADIO || type == HTMLCTRL.SELECT
}

function grid::GetElemS(row,col)
{
	if (col == columns.size)
	{
		if (grid.Elem(row, columns.ctrlType) != HTMLCTRL.TEXT)
		{
			grid.EventResult = ""
			return
		}
	}
	else if (col == columns.imgWidth || col == columns.imgHeight)
	{
		if (grid.Elem(row, columns.ctrlType) != HTMLCTRL.IMAGE)
		{
			grid.EventResult = ""
			return
		}
	}
	else if (col == columns.enumValues)
	{
		if (!IsEnumControl(grid.Elem(row, columns.ctrlType)))
		{
			grid.EventResult = ""
			return
		}
	}
	
	grid.EventResult = window.external.DataGet(BuildPath(row,col), 0)
}

function grid::GetElemI(row,col)
{
	// forzo campo readonly vuoto se controllo di tipo bottone
	if (col == columns.readOnly && grid.Elem(row, columns.ctrlType) == HTMLCTRL.BUTTON)
	{
		grid.EventResult = "";
		return;
	}

	grid.EventResult = window.external.DataGet(BuildPath(row,col), 0)
}

function grid::SetElemS(row,col,s)
{
	if (col == columns.name)
		grid.Update(row, columns.ctrlType);

	window.external.DataSet(BuildPath(row,col), 0, s)
}

function grid::SetElemI(row,col,i)
{
	window.external.DataSet(BuildPath(row,col), 0, i)

	if (col == columns.ctrlType)
	{
		// se si è appena cambiato il tipo di controllo rinfresca il size e enumValues
		grid.Update(row, columns.size)
		grid.Update(row, columns.enumValues)
		grid.Update(row, columns.imgWidth)
		grid.Update(row, columns.imgHeight)
		grid.Update(row, columns.readOnly)
	}
}

function grid::GetRecordNum()
{
	var list = window.external.SelectNodesXML(gridDatapath + "/*")
	if (list) grid.EventResult = list.length
}

function CopyGetCurValue(row, col)
{
	var value = grid.Elem(row, col)
	
	// per le colonne imgWidth e imgHeight: se il controllo non è di tipo immagine, anche se il contenuto è 0, visualizza ""
	// essendo però interi, ritorna cmq il valore 0 altrimenti sul paste da errore!
	if (col == columns.imgWidth || col == columns.imgHeight)
		if (value == "")
			value = 0
			
	return value
}

function grid::PopupMenu(row, col, x, y)
{
	ShowGridPopup(grid, row, col, x, y, gridDatapath, rowTemplate, "menu_gridPopup", undefined, undefined, CopyGetCurValue)
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::SpecialEvent(id, param)
{
	GridSpecialEvent(id, param, grid, gridDatapath, rowTemplate)
}

function grid::AllowEdit(row,col)
{
	if (col == columns.size || col == columns.format)
		// colonna size e format editabile solo per il tipo di controllo text
		grid.EventResult = (grid.Elem(row, columns.ctrlType) == HTMLCTRL.TEXT)
	else if (col == columns.imgWidth || col == columns.imgHeight)
		// colonna img filename editabile solo per il tipo di controllo image
		grid.EventResult = (grid.Elem(row, columns.ctrlType) == HTMLCTRL.IMAGE)
	else if (col == columns.enumValues)
		// colonna enumValues editabile solo per i tipi di controllo enumerativi
		grid.EventResult = IsEnumControl(grid.Elem(row, columns.ctrlType))
	else if (col == columns.readOnly)
	{
		var varName = grid.Elem(row, columns.name);
		if (varName)
		{
			var varObj = m_globalVarsMap[varName];
			// il bottone non puo' essere read only, e l'oggetto associato non deve essere lui readonly a monte
			grid.EventResult = (grid.Elem(row, columns.ctrlType) != HTMLCTRL.BUTTON) && varObj && !varObj.readOnly;
		}
	}
	else
		grid.EventResult = true
}

function grid::OptionClick(row,col)
{
	if (grid.Elem(row, columns.ctrlType) == HTMLCTRL.IMAGE)
	{
		// nome variabile
		app.TempVar("ImagesWizard_enum") = grid.Elem(row, columns.name);

		// valore della cella che puo' avere gia' un elenco di immagini
		app.TempVar("ImagesWizard_enum_images") = grid.Elem(row, columns.enumValues);

		app.OpenWindow("ImagesWizard", app.Translate('Select images'), "");

		let result = app.TempVar("ImagesWizard_enum_result");
		app.TempVar("ImagesWizard_enum_result") = undefined;

		if (result)
			grid.Elem(row, columns.enumValues) = result;
	}
	else
	{
		// nome variabile
		app.TempVar("EnumsWizard_enum") = grid.Elem(row, columns.name);

		// valore della cella che puo' avere gia' una espressione
		app.TempVar("EnumsWizard_enum_expr") = grid.Elem(row, columns.enumValues);

		app.OpenWindow("webEnumsWizard", app.Translate('Values wizard'), "");

		let result = app.TempVar("EnumsWizard_enum_result");
		app.TempVar("EnumsWizard_enum_result") = undefined;

		if (result)
			grid.Elem(row, columns.enumValues) = result;
	}
}

/*function grid::GetColType(row,col)
{
	grid.EventResult = egColumnType.egOption
}*/

function grid:: OnDragOver(strData, clipFormat, keyState, row, col)
{
	// per ora gestito solo testo, formato XML implementato solo nelle griglie CPLCVarsDocument, non da albero
	if (clipFormat != CF_UNICODETEXT)
	{
		grid.EventResult = DROPEFFECT.DROPEFFECT_NONE
		return;
	}

	var plcVar = app.CallFunction("logiclab.GetGlobalVariable", strData)
	if (!plcVar || !m_globalVarsMap[plcVar.name])
	{
		grid.EventResult = DROPEFFECT.DROPEFFECT_NONE
		return;
	}

	grid.EventResult = DROPEFFECT.DROPEFFECT_COPY
}

function grid:: OnDrop(strData, clipFormat, dropEffect, row, col)
{
	if (strData == "" || clipFormat != CF_UNICODETEXT || dropEffect != DROPEFFECT.DROPEFFECT_COPY)
	{
		grid.EventResult = false
		return;
	}

	var plcVar = app.CallFunction("logiclab.GetGlobalVariable", strData)
	if (!plcVar || !m_globalVarsMap[plcVar.name])
	{
		grid.EventResult = false
		return;
	}

	grid_AddRowXML()

	grid.Elem(grid.NumRows - 1, columns.name) = plcVar.name

	grid.EditMode(false)
	grid.EventResult = true
}
