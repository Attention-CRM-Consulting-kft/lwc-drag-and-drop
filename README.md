To select multiple items hold down the <kbd>Ctrl</kbd> key.

To clone items hold down the <kbd>Shift</kbd> key.

The drag-and-drop components with the same group can send and recieve items.


**DEMO**

dragAndDropDemo.html

```html
<!-- Drag And Drop Demo -->
<template>
  <div class="slds-grid slds-grid_align-space" style="height: 45rem;width: 40rem;">
    <div style="width: 10rem;">
      <c-drag-and-drop
        items={items1}
        display-field="name"
        name="items1"
        onchange={handleItemsChange}
        group="1"
        orderable
        cloneable
        deletable
      ></c-drag-and-drop>
    </div>
    <div style="width: 10rem;">
      <c-drag-and-drop
        items={items2}
        display-field="name"
        name="items2"
        onchange={handleItemsChange}
        group="1"
        orderable
        cloneable
        deletable
      ></c-drag-and-drop>
    </div>
  </div>
</template>
```


dragAndDropDemo.js
```javascript
import { LightningElement, track } from "lwc";

export default class DragAndDropDemo extends LightningElement {

  @track items1 = [];
  @track items2 = [];

  connectedCallback() {
    for (let i = 1; i < 8; i++) {
      this.items1.push({ name: "Foo " + i });
      this.items2.push({ name: "Bar " + i });
    }
  }

  handleItemsChange(event) {
    switch (event.target.name) {
      case "items1":
        this.items1 = event.detail.items;
        console.log(`this.items1`,JSON.parse(JSON.stringify(this.items1)));
        break;
      case "items2":
        this.items2 = event.detail.items;
        console.log(`this.items2`,JSON.parse(JSON.stringify(this.items2)));
        break;
    }
    if (event.detail.deletedItems) {
      console.log("deleted items:", JSON.parse(JSON.stringify(event.detail.deletedItems)));
    }
  }
}
```
