/**
 * Created by GM on 3/24/2022.
 */

import { LightningElement, track } from "lwc";

export default class DragAndDropDemo extends LightningElement {

  @track items1 = [];
  @track items2 = [];

  connectedCallback() {
    for (let i = 1; i < 8; i++) {
      this.items1.push({ name: "Foo " + i });
      this.items2.push({ name: "Bar " + i });
    }
    this.items1[0].style = "font-weight: bold;";
    this.items2[0].styleClass = "slds-text-title_bold";
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
