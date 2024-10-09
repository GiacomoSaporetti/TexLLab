var app = window.external;
var gentypes = app.CallFunction("common.GetGeneralTypes");

function InitPage()
{
	try
	{
		grid.SetDarkTheme(m_darkTheme);
	}
	catch (err) {}

	// con dark theme vengono usate altre immagini
	let imgPathPrefix = m_darkTheme ? "../img/btn/dark_theme/" : "../img/btn/";

	imgPlus.src = csspath + imgPathPrefix + 'plus.png';
	imgMinus.src = csspath + imgPathPrefix + 'minus.png';

	var path = _DATAPATH
	pageTitle.innerText = "'" + app.DataGet(path + "@caption", 0) + "' " + tablePath.replace("[1]", "") + " " + app.Translate("configuration");
}