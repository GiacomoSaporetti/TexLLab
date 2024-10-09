function BuilParametrizationPath(row,col) {
	return gridParametrizationDatapath + "/sendParam[" + (row+1) + "]/" + m_ParametrizationNodes[col];
}

function GridParametrizationGetRecordNum() {
	var list = m_xmldoc.selectNodes(gridParametrizationDatapath + "/*");
	if (list)
		return list.length;

	return 0;
}

function gridParametrization::GetElemS(row,col)
{
	var res = GetNode(m_xmldoc, BuilParametrizationPath(row,col));

	if (col == gridParametrizationColumns.parameter) {
		// nell'XML c'e' l'ipa ma viene visualizzato il nome del parametro
		var ipa = GetNode(m_xmldoc, BuilParametrizationPath(row, gridParametrizationColumns.address));
		var query = gridDatapath + genfuncs.FormatMsg("/par[@ipa=%1]/@name", ipa);
		res = GetNode(m_xmldoc, query);
	}
	else if (col == gridParametrizationColumns.address) {
		// nell'XML c'e' l'ipa ma viene visualizzato l'indirizzo modbus
		var ipa = GetNode(m_xmldoc, BuilParametrizationPath(row,col));
		var query = gridDatapath + genfuncs.FormatMsg("/par[@ipa=%1]/protocol/@commaddr", ipa);
		res = GetNode(m_xmldoc, query);
	}

	gridParametrization.EventResult = res;
}

function gridParametrization::SetElemS(row,col,s)
{
	if (s == gridParametrization.Elem(row,col))
		return;

	SetNode(m_xmldoc, BuilParametrizationPath(row,col), s);

	SetModifiedFlag();
}

function gridParametrization::GetElemI(row,col)
{
	gridParametrization.EventResult = GetNode(m_xmldoc, BuilParametrizationPath(row,col));
}

function gridParametrization::SetElemI(row,col,i)
{
	if (i == gridParametrization.Elem(row,col))
		return;

	SetNode(m_xmldoc, BuilParametrizationPath(row,col), i);

	SetModifiedFlag();
}

function gridParametrization::GetRecordNum()
{
	gridParametrization.EventResult = GridParametrizationGetRecordNum();
}