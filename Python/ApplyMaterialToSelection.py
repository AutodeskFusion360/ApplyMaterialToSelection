#Author-Autodesk Inc.
#Description-Apply a material to selected bodies.

import adsk.core, adsk.fusion, traceback

commandId = 'ApplyMaterialToSelectionCommand'
commandName = 'ApplyMaterialToSelection'
commandDescription = 'Apply a material to selected bodies or occurrences'

app = None
ui = None

# global set of event handlers to keep them referenced for the duration of the command
handlers = []
materialsMap = {}

app = adsk.core.Application.get()
if app:
    ui  = app.userInterface
    
class ApplyMaterialInputChangedHandler(adsk.core.InputChangedEventHandler):
    def __init__(self):
        super().__init__()
    def notify(self, args):
        try:
            cmd = args.firingEvent.sender
            inputs = cmd.commandInputs
            materialListInput = None
            filterInput = None
            materialLibInput = None
            global commandId
            for inputI in inputs:
                if inputI.id == commandId + '_materialList':
                    materialListInput = inputI
                elif inputI.id == commandId + '_filter':
                    filterInput = inputI
                elif inputI.id == commandId + '_materialLib':
                    materialLibInput = inputI
            cmdInput = args.input
            if cmdInput.id == commandId + '_materialLib' or cmdInput.id == commandId + '_filter':
                materials = getMaterialsFromLib(materialLibInput.selectedItem.name, filterInput.value)
                replaceItems(materialListInput, materials)

        except:
            if ui:
                ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

class ApplyMaterialToSelectionCommandExecuteHandler(adsk.core.CommandEventHandler):
    def __init__(self):
        super().__init__()
    def notify(self, args):
        try:
            command = args.firingEvent.sender
            inputs = command.commandInputs
            for input in inputs:
                if input.id == commandId + '_selection':
                    selectionInput = input
                elif input.id == commandId + '_materialList':
                    materialListInput = input

            bodies = getSelectedBodies(selectionInput)
            if len(bodies) == 0:
                return
            
            material = getMaterial(materialListInput.selectedItem.name)
            if not material:
                return

            applyMaterialToBodies(material, bodies)

        except:
            if ui:
                ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

class ApplyMaterialToSelectionCommandDestroyHandler(adsk.core.CommandEventHandler):
    def __init__(self):
        super().__init__()
    def notify(self, args):
        try:
            # when the command is done, terminate the script
            # this will release all globals which will remove all event handlers
            adsk.terminate()
        except:
            if ui:
                ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

class ApplyMaterialToSelectionCommandCreatedHandler(adsk.core.CommandCreatedEventHandler):    
    def __init__(self):
        super().__init__()        
    def notify(self, args):
        try:
            cmd = args.command
            onExecute = ApplyMaterialToSelectionCommandExecuteHandler()
            cmd.execute.add(onExecute)
            onDestroy = ApplyMaterialToSelectionCommandDestroyHandler()
            cmd.destroy.add(onDestroy)
            onInputChanged = ApplyMaterialInputChangedHandler()
            cmd.inputChanged.add(onInputChanged)
            # keep the handler referenced beyond this function
            handlers.append(onExecute)
            handlers.append(onDestroy)
            handlers.append(onInputChanged)

            # Define the inputs.
            inputs = cmd.commandInputs
            
            global commandId
            selectionInput = inputs.addSelectionInput(commandId + '_selection', 'Select', 'Select bodies or occurrences')
            selectionInput.setSelectionLimits(1)
            selectionInput.selectionFilters = ['SolidBodies', 'Occurrences']
            materialLibInput = inputs.addDropDownCommandInput(commandId + '_materialLib', 'Material Library', adsk.core.DropDownStyles.LabeledIconDropDownStyle)
            listItems = materialLibInput.listItems
            materialLibNames = getMaterialLibNames()
            for materialName in materialLibNames :
                listItems.add(materialName, False, '')
            listItems[1].isSelected = True
            materialListInput = inputs.addDropDownCommandInput(commandId + '_materialList', 'Material', adsk.core.DropDownStyles.TextListDropDownStyle)
            materials = getMaterialsFromLib(materialLibNames[1], '')
            listItems = materialListInput.listItems
            for materialName in materials :
                listItems.add(materialName, False, '')
            listItems[0].isSelected = True
            inputs.addStringValueInput(commandId + '_filter', 'Filter', '')

        except:
            if ui:
                ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

def getMaterial(materialName):
    materialLibs = app.materialLibraries
    material = None
    for materialLib in materialLibs:
        materials = materialLib.materials
        try:
            material = materials.itemByName(materialName)
        except:
            pass
        if material:
            break
    return material

def getSelectedBodies(selectionInput):
    bodies = []
    for x in range(0, selectionInput.selectionCount):
        mySelection = selectionInput.selection(x)
        selectedObj = mySelection.entity
        if adsk.fusion.BRepBody.cast(selectedObj):
            bodies.append(selectedObj)
        elif adsk.fusion.Occurrence.cast(selectedObj):
            component = selectedObj.component
            componentBodies = component.bRepBodies
            for componentBody in componentBodies:
                bodies.append(componentBody)
    return bodies

def applyMaterialToBodies(material, bodies):
    for body in bodies:
        body.material = material
        
def clearAllItems(cmdInput):
    cmdInput.listItems.add('None', True, '')
    while cmdInput.listItems.count > 1:
        if cmdInput.listItems[0].name != 'None':
            cmdInput.listItems[0].deleteMe()
        else:
            cmdInput.listItems[1].deleteMe()
            
def replaceItems(cmdInput, newItems):
    clearAllItems(cmdInput)
    if len(newItems) > 0:
        for item in newItems:
            cmdInput.listItems.add(item, False, '')
        cmdInput.listItems[1].isSelected = True
        cmdInput.listItems[0].deleteMe()
        
def getMaterialLibNames():
    materialLibs = app.materialLibraries
    libNames = []
    for materialLib in materialLibs:
        if materialLib.materials.count > 0:
            libNames.append(materialLib.name)
    return libNames
    
def getMaterialsFromLib(libName, filterExp):
    global materialsMap
    materialList = None
    if libName in materialsMap:
        materialList = materialsMap[libName]
    else:
        materialLib = app.materialLibraries.itemByName(libName)
        materials = materialLib.materials
        materialNames = []
        for material in materials:
            materialNames.append(material.name)
        materialsMap[libName] = materialNames
        materialList = materialNames

    if filterExp and len(filterExp) > 0:
        filteredList = []
        for materialName in materialList:
            if materialName.lower().find(filterExp.lower()) >= 0:
                filteredList.append(materialName)
        return filteredList
    else:
        return materialList

def main():
    try:
        cmdDef = ui.commandDefinitions.itemById(commandId)
        if not cmdDef:
            cmdDef = ui.commandDefinitions.addButtonDefinition(commandId, commandName, commandDescription) # no resource folder is specified, the default one will be used

        onCommandCreated = ApplyMaterialToSelectionCommandCreatedHandler()
        cmdDef.commandCreated.add(onCommandCreated)
        # keep the handler referenced beyond this function
        handlers.append(onCommandCreated)

        inputs = adsk.core.NamedValues.create()
        cmdDef.execute(inputs)

        # prevent this module from being terminate when the script returns, because we are waiting for event handlers to fire
        adsk.autoTerminate(False)

    except:
        if ui:
            ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

main()
