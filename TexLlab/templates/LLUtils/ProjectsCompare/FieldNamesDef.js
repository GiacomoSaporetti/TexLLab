// costanti per la corrispondenza tra nome del field di basso livello e nome umanamente significativo
const STRINGS = {
	objType: app.Translate("Object type"),
	m_version: app.Translate("Version"),
	descr: app.Translate("Description"),
	group: app.Translate("Group"),
	name_: app.Translate("Name"),
	readonly_: app.Translate("Read only"),
	hidden_: app.Translate("Hidden"),
	title_: app.Translate("Title"),
	excludeFromBuild_: app.Translate("Exclusion from build"),
	attr: app.Translate("Attribute"),
	class_: app.Translate("Class"),
	varIO_: app.Translate("I/O variable"),
	varIORetain_: app.Translate("I/O retentive variable"),
	loc_: app.Translate("Location"),
	type_: app.Translate("Type"),
	iMinIndex_: app.Translate("Array min index"),
	iMaxIndex_: app.Translate("Array max index"),
	strMinIndex_: app.Translate("Array min index name"),
	strMaxIndex_: app.Translate("Array max index name"),
	strSize_: app.Translate("String size"),
	m_initString: app.Translate("Init value"),
	m_IECDecl: app.Translate("IEC declaration"),
	label: app.Translate("Network label"),
	m_disabled: app.Translate("Network disabled"),
	m_disableIfNotDef: app.Translate("Network disabled conditionally"),
	sourceCode: app.Translate("Source code"),
	srcType: app.Translate("Source type"),
	extendsNameFB: app.Translate("Extended function block"),
	extendsNameIF: app.Translate("Extended interfaces"),
	implementsNames: app.Translate("Implemented interfaces"),
	baseType_: app.Translate("Base type"),
	taskId_: app.Translate("Task ID"),
	m_taskType: app.Translate("Task type"),
	period_: app.Translate("Task period"),
	m_minPeriod: app.Translate("Task period min value"),
	m_maxPeriod: app.Translate("Task period max value"),
	hasImg: app.Translate("Process image"),
	prgNames: app.Translate("Program names"),
	typeBase: app.Translate("Base type"),
	valMin: app.Translate("Min value"),
	valMax: app.Translate("Max value")
};

const FIELD_NAMES = {
	VAR: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		attr: STRINGS.attr,
		class_: STRINGS.class_,
		varIO_: STRINGS.varIO_,
		varIORetain_: STRINGS.varIORetain_,
		loc_: STRINGS.loc_,
		type_: STRINGS.type_,
		iMinIndex_: STRINGS.iMinIndex_,
		iMaxIndex_: STRINGS.iMaxIndex_,
		strMinIndex_: STRINGS.strMinIndex_,
		strMaxIndex_: STRINGS.strMaxIndex_,
		strSize_: STRINGS.strSize_,
		m_initString: STRINGS.m_initString
	},
	TYPEDEF: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		type_: STRINGS.type_,
		iMinIndex_: STRINGS.iMinIndex_,
		iMaxIndex_: STRINGS.iMaxIndex_,
		strMinIndex_: STRINGS.strMinIndex_,
		strMaxIndex_: STRINGS.strMaxIndex_,
		strSize_: STRINGS.strSize_,
		m_initString: STRINGS.m_initString,
		m_IECDecl: STRINGS.m_IECDecl
	},
	SUBRANGE: {
		m_IECDecl: STRINGS.m_IECDecl,
		typeBase: STRINGS.typeBase,
		valMin: STRINGS.valMin,
		valMax: STRINGS.valMax,
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_
	},
	STRUCT: {
		m_IECDecl: STRINGS.m_IECDecl,
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_
	},
	PROGRAM: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		label: STRINGS.label,
		m_disabled: STRINGS.m_disabled,
		m_disableIfNotDef: STRINGS.m_disableIfNotDef,
		sourceCode: STRINGS.sourceCode,
		srcType: STRINGS.srcType,
		m_IECDecl: STRINGS.m_IECDecl
	},
	NETWORK: {
		label: STRINGS.label,
		m_disabled: STRINGS.m_disabled,
		m_disableIfNotDef: STRINGS.m_disableIfNotDef,
		sourceCode: STRINGS.sourceCode,
	},
	FUNCTION: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		label: STRINGS.label,
		m_disabled: STRINGS.m_disabled,
		m_disableIfNotDef: STRINGS.m_disableIfNotDef,
		sourceCode: STRINGS.sourceCode,
		srcType: STRINGS.srcType,
		m_IECDecl: STRINGS.m_IECDecl
	},
	METHOD: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		label: STRINGS.label,
		m_disabled: STRINGS.m_disabled,
		m_disableIfNotDef: STRINGS.m_disableIfNotDef,
		sourceCode: STRINGS.sourceCode,
		srcType: STRINGS.srcType,
		m_IECDecl: STRINGS.m_IECDecl
	},
	METHODPROTOTYPE: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		label: STRINGS.label,
		m_disabled: STRINGS.m_disabled,
		m_disableIfNotDef: STRINGS.m_disableIfNotDef,
		sourceCode: STRINGS.sourceCode,
		srcType: STRINGS.srcType,
		m_IECDecl: STRINGS.m_IECDecl
	},
	FUNCTIONBLOCK: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		label: STRINGS.label,
		m_disabled: STRINGS.m_disabled,
		m_disableIfNotDef: STRINGS.m_disableIfNotDef,
		sourceCode: STRINGS.sourceCode,
		srcType: STRINGS.srcType,
		m_IECDecl: STRINGS.m_IECDecl,
		extendsName: STRINGS.extendsNameFB,
		implementsNames: STRINGS.implementsNames
	},
	MACRO: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		srcType: STRINGS.srcType,
		sourceCode: STRINGS.sourceCode
	},
	INTERFACE: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		extendsName: STRINGS.extendsNameIF
	},
	ENUM: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		baseType_: STRINGS.baseType_,
		m_IECDecl: STRINGS.m_IECDecl
	},
	TASK: {
		objType: STRINGS.objType,
		m_version: STRINGS.m_version,
		descr: STRINGS.descr,
		group: STRINGS.group,
		name_: STRINGS.name_,
		readonly_: STRINGS.readonly_,
		hidden_: STRINGS.hidden_,
		title_: STRINGS.title_,
		excludeFromBuild_: STRINGS.excludeFromBuild_,
		taskId_: STRINGS.taskId_,
		m_taskType: STRINGS.m_taskType,
		period_: STRINGS.period_,
		m_minPeriod: STRINGS.m_minPeriod,
		m_maxPeriod: STRINGS.m_maxPeriod,
		hasImg: STRINGS.hasImg,
		prgNames: STRINGS.prgNames
	}
}