import {LightningElement, api, track, wire} from "lwc";
import {registerDragDropper, unregisterDragDropper} from "c/dragDropStore";

const animationTime = 100;
//const longTouchDuration = 500;

export default class DragAndDrop extends LightningElement {
  @api deletable = false;
  @api cloneable = false;
  @api orderable = false;
  @api undo;
  @api isLoading;
  @api name;
  @api label;
  @api placeholder;
  @api isHorizontal;

  click() {
    try {
      this.itemContainer = this.template.querySelector(".item-container");
      this.itemContainer.scrollTop = this.itemContainer.scrollTop + 20;
    } catch (error) {
      console.error(error);
    }
  }

  @api get displayField() {
    return this._displayField;
  }

  set displayField(value) {
    this._displayField = value;
    for (const item of this._items) {
      this.setFields(item);
    }
  }

  @api get group() {
    return this._group;
  }

  set group(value) {
    if (this.group != null) {
      unregisterDragDropper(this, this.group);
    }
    this._group = value;
    if (this._group) {
      this.storeActions = registerDragDropper(this, {name: this.group, handler: this.dragDropStateHandler, initialState: {group: this.group}});
    }
  }

  @api get items() {
    return this._items;
  }

  set items(items) {
    if (this.originalItems != null || items != null) {
      this._items = [];
      if (items) {
        for (const value of items) {
          let item = {...value};
          this.setFields(item);
          this._items.push(item);
        }
        //console.log(`setter this._items`, JSON.parse(JSON.stringify(this._items)));
      }
      if (this.originalItems == null) {
        this.originalItems = [...this._items];
      }
    }
  }

  @track _items = [];
  originalItems;
  _group;
  _displayField;
  containerId = Math.floor(Math.random() * 100000000);
  storeActions;
  cache = [];
  version = 0;
  info = {};
  isGuestItemInTheContainer;
  isItemContainerScrollingEnabled = false;

  dragDropContainer;
  itemContainer;
  itemElements;
  unmovedElements = [];
  itemPlaceHolder;
  binBox;

  hasRendered = false;
  selectedItems = [];
  selectedMainItem;
  isDraggedItemInTheContainer;
  isItemDragEnabled = true;
  hasDragStarted = false;
  isCtrlButtonPressed = false;
  isShiftButtonPressed = false;
  isLongTouch = false;
  lastMouseY;
  lastMouseX;

  connectedCallback() {
    //console.log(`this.orderable`, this.orderable);
  }

  setFields(item) {
    item._dragDropItemId = Math.floor(Math.random() * 100000000);
    if (this.displayField != null) {
      item._dragDropName = item[this.displayField];
    } else if (item.Name != null) {
      item._dragDropName = item.Name;
    } else if (item.name != null) {
      item._dragDropName = item.name;
    } else if (item.Id != null) {
      item._dragDropName = item.Id;
    } else {
      item._dragDropName = item._dragDropItemId;
    }
    item._dragAndDropStyleClass = 'item';
    if (item.styleClass != null) {
      item._dragAndDropStyleClass += ' ' + item.styleClass;
    }
  }

  renderedCallback() {
    if (this.hasRendered === false) {
      addEventListener("keydown", this.keyDownListener);
      //addEventListener("keypress", this.keyPressListener);
      addEventListener("keyup", this.keyUpListener);
      addEventListener("touchend", this.touchEndListener);
      addEventListener("mousedown", this.mouseDownHandler);
      addEventListener("wheel", this.handleWheel);
      addEventListener("blur", this.windowBlurHandler);

      /*addEventListener('mousemove', this.handleMouseMove, {passive: true});
      addEventListener('mouseup', this.handleDrapEnd);*/

      addEventListener("mousemove", (event) => {
        this.info.mousePos = event.clientX + " " + event.clientY;
        this.info = {...this.info};
      }, {passive: true});
      this.hasRendered = true;
    }
    this.dragDropContainer = this.template.querySelector(".drag-drop-container");
    this.itemContainer = this.dragDropContainer?.querySelector(".item-container");
    this.itemElements = this.itemContainer?.querySelectorAll(".item");
    //console.log('renderedCallback');
  }

  windowBlurHandler = event => {
    this.resetItems();
    removeEventListener("mousemove", this.handleFirstDrag);
    removeEventListener("mousemove", this.handleDrag);
    removeEventListener("mouseup", this.handleDragEnd);
    removeEventListener("touchmove", this.handleFirstDrag);
    removeEventListener("touchmove", this.handleDrag);
    removeEventListener("touchend", this.handleDragEnd);
    this.hasDragStarted = false;
    this.isItemDragEnabled = true;
    this.isItemContainerScrollingEnabled = false;
    this.isCtrlButtonPressed = false;
    this.isShiftButtonPressed = false;
  }

  handleWheel = (event) => {
    if (this.isItemContainerScrollingEnabled) {
      this.itemContainer.scrollTop = this.itemContainer.scrollTop + event.deltaY;
      if (this.isGuestItemInTheContainer) {
        let guestItemHeight = this.state.position.bottom - this.state.position.top;
        let top = this.state.position.top;
        for (let i = 0; i < this.itemElements.length; i++) {
          if (top < this.itemElements[i].getBoundingClientRect().top) {
            this.translateItem(this.itemElements[i], guestItemHeight, true);
          } else {
            this.translateItem(this.itemElements[i], 0, true);
          }
        }
      } else {
        let newIndex = this.unmovedElements.length;
        let selectedItemBoundingClientRect = this.selectedMainItem.getBoundingClientRect();
        for (let i = 0; i < this.unmovedElements.length; i++) {
          if (selectedItemBoundingClientRect.top < this.unmovedElements[i].getBoundingClientRect().top) {
            if (i < newIndex) {
              newIndex = i;
            }
            this.translateItem(this.unmovedElements[i], selectedItemBoundingClientRect.height, true);
          } else {
            this.translateItem(this.unmovedElements[i], 0, true);
          }
        }
        this.selectedMainItem.currentIndex = newIndex;
      }
    }
  }

  handleContextMenu(e) {
    if (this.isCtrlButtonPressed || this.hasDragStarted) {
      e.preventDefault();
    }
  }

  disconnectedCallback() {
    removeEventListener("keydown", this.keyDownListener);
    //removeEventListener("keypress", this.keyPressListener);
    removeEventListener("keyup", this.keyUpListener);
    removeEventListener("touchend", this.touchEndListener);
    removeEventListener("mousedown", this.mouseDownHandler);
    removeEventListener("mousemove", this.handleFirstDrag);
    removeEventListener("mousemove", this.handleDrag);
    removeEventListener("mouseup", this.handleDragEnd);
    removeEventListener("wheel", this.handleWheel)
    removeEventListener("blur", this.windowBlurHandler);
    unregisterDragDropper(this, this.group);
  }

  keyDownListener = e => {
    this.isCtrlButtonPressed = e.key === "Control";
    this.isShiftButtonPressed = e.key === "Shift";
    if (this.isShiftButtonPressed && this.hasDragStarted && this.cloneable) {
      this.selectedMainItem.style.cursor = "copy";
    }
  };

  keyUpListener = e => {
    if (e.key === "Control") {
      this.isCtrlButtonPressed = false;
    }
    if (e.key === "Shift") {
      this.isShiftButtonPressed = false;
      if (this.selectedMainItem) {
        this.selectedMainItem.style.cursor = "";
      }
    }
  };

  touchEndListener = e => {
    this.isLongTouch = false;
  };

  keyPressListener = e => {
    this.isCtrlButtonPressed = false;
  };

  mouseDownHandler = e => {
    if (this.hasDragStarted === true) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (this.isItemDragEnabled === true) {
      for (const item of this.selectedItems) {
        item.classList.remove("selected");
      }
      this.selectedItems = [];
      this.selectedMainItem = null;
    }
  };

  handleItemTouchStart = event => {
    if (this.isItemDragEnabled === true) {
      event.preventDefault();
      event.stopPropagation();
      /*if (this.isCtrlButtonPressed) {
          let selectedItem = event.currentTarget;
          selectedItem.classList.toggle('selected');
          if (selectedItem.classList.contains('selected')) {
              this.selectedItems.push(selectedItem);
          } else {
              this.selectedItems = this.selectedItems.filter(e => e !== selectedItem);
          }
          //console.log(`this.selectedItemElements`, this.selectedItems);
      } else {
          this.lastMouseY = event.touches[0].clientY;
          this.lastMouseX = event.touches[0].clientX;
          this.selectedMainItem = event.currentTarget;
          this.handleFirstItemInteraction()
      }*/
      this.lastMouseY = event.touches[0].clientY;
      this.lastMouseX = event.touches[0].clientX;
      this.selectedMainItem = event.currentTarget;
      this.handleFirstItemInteraction();
    }
  };

  handleItemMouseDown = (event) => {
    if (event.button !== 0) {
      return;
    }
    if (this.isItemDragEnabled === true) {
      event.preventDefault();
      event.stopPropagation();
      if (this.isCtrlButtonPressed) {
        let selectedItem = event.currentTarget;
        selectedItem.classList.toggle("selected");
        if (selectedItem.classList.contains("selected")) {
          this.selectedItems.push(selectedItem);
        } else {
          this.selectedItems = this.selectedItems.filter(e => e !== selectedItem);
        }
        //console.log(`this.selectedItemElements`, this.selectedItems);
      } else {
        this.lastMouseY = event.clientY;
        this.lastMouseX = event.clientX;
        this.selectedMainItem = event.currentTarget;
        this.handleFirstItemInteraction();
      }
    }
  };

  handleFirstItemInteraction() {
    try {
      addEventListener("mousemove", this.handleFirstDrag, {passive: true, once: true});
      addEventListener("mousemove", this.handleDrag, {passive: true});
      addEventListener("touchmove", this.handleFirstDrag, {passive: true, once: true});
      addEventListener("touchmove", this.handleDrag, {passive: true});
      addEventListener("mouseup", this.handleDragEnd);
      addEventListener("touchend", this.handleDragEnd);
      this.initItems();
      this.selectedMainItem.classList.add("main");
      let boundingClientRect = this.selectedMainItem.getBoundingClientRect();
      this.selectedMainItem.yDiff = this.lastMouseY - boundingClientRect.top;
      this.selectedMainItem.xDiff = this.lastMouseX - boundingClientRect.left;
      if (!this.selectedMainItem.classList.contains("selected")) {
        this.selectedItems.forEach(e => e.classList.remove("selected"));
        this.selectedMainItem.classList.add("selected");
        this.selectedItems = [this.selectedMainItem];
      }

      this.selectedItems.sort((a, b) => +a.dataset.index - +b.dataset.index);
      let selectedItemElementIndex = this.selectedItems.indexOf(this.selectedMainItem);
      let indexDiff = 1;
      // set top left distance from mouse position of selected items above main item
      for (let i = selectedItemElementIndex - 1; i >= 0; i--) {
        this.selectedItems[i].yDiff = this.lastMouseY - boundingClientRect.top + (boundingClientRect.height * indexDiff);
        this.selectedItems[i].xDiff = this.lastMouseX - boundingClientRect.left;
        indexDiff++;
      }
      indexDiff = 1;
      // set top left distance from mouse position of selected items under main item
      for (let i = selectedItemElementIndex + 1; i < this.selectedItems.length; i++) {
        this.selectedItems[i].yDiff = this.lastMouseY - boundingClientRect.top - (boundingClientRect.height * indexDiff);
        this.selectedItems[i].xDiff = this.lastMouseX - boundingClientRect.left;
        indexDiff++;
      }
      this.unmovedElements = [];
      for (let i = 0; i < this.itemElements.length; i++) {
        let item = this.itemElements[i];
        if (this.selectedItems.indexOf(item) === -1) {
          this.unmovedElements.push(item);
        }
      }
      for (const item of this.selectedItems) {
        let itemBoundingClientRect = item.getBoundingClientRect();
        item.style.height = itemBoundingClientRect.height + "px";
        item.style.width = itemBoundingClientRect.width + "px";
      }
      this.selectedMainItem.originalIndex = Math.min(+this.selectedMainItem.dataset.index, this.unmovedElements.length);
      this.selectedMainItem.currentIndex = this.selectedMainItem.originalIndex;
      this.isDraggedItemInTheContainer = true;
      this.itemContainer.originalScrollTop = this.itemContainer.scrollTop;
    } catch (error) {
      console.error(error);
    }
  }

  handleFirstDrag = event => {
    this.itemContainer.classList.add('active');
    this.itemPlaceHolder.style.display = 'block';
    this.hasDragStarted = true;
    for (const selectedItem of this.selectedItems) {
      selectedItem.style.position = "fixed";
    }
    for (let i = this.selectedMainItem.currentIndex; i < this.unmovedElements.length; i++) {
      this.translateItem(this.unmovedElements[i], this.selectedMainItem.getBoundingClientRect().height, false);
    }
    for (let i = 0; i < this.selectedItems.length; i++) {
      let selectedItemElement = this.selectedItems[i];
      selectedItemElement.style.top = (this.lastMouseY - selectedItemElement.yDiff) + "px";
      selectedItemElement.style.left = (this.lastMouseX - selectedItemElement.xDiff) + "px";
    }
    if (this.group != null) {
      this.publishItemDragStart();
    }
    this.isItemContainerScrollingEnabled = true;
  };

  handleDrag = event => {
    try {
      if (this.selectedMainItem != null && this.isItemDragEnabled === true) {
        for (let i = 0; i < this.selectedItems.length; i++) {
          let selectedItemElement = this.selectedItems[i];
          selectedItemElement.style.top = (this.lastMouseY - selectedItemElement.yDiff) + "px";
          selectedItemElement.style.left = (this.lastMouseX - selectedItemElement.xDiff) + "px";
        }
        let isDraggedItemIsInTheContainer = this.isElementInTheOther(this.itemContainer, this.selectedMainItem);
        let selectedItemBoundingClientRect = this.selectedMainItem.getBoundingClientRect();
        this.itemHasJustLeftTheContainer = isDraggedItemIsInTheContainer === false && this.isDraggedItemInTheContainer === true;
        this.itemHasJustEnteredTheContainer = isDraggedItemIsInTheContainer === true && this.isDraggedItemInTheContainer === false;
        this.isDraggedItemInTheContainer = isDraggedItemIsInTheContainer;
        if (this.group != null && this.isDraggedItemInTheContainer === false) {
          this.publishItemDrag();
        }
        if (this.itemHasJustLeftTheContainer === true && this.orderable === true) {
          this.selectedMainItem.currentIndex = this.selectedMainItem.originalIndex;
          for (const unmovedElement of this.unmovedElements) {
            this.translateItem(unmovedElement, 0, true);
          }
          this.isItemContainerScrollingEnabled = false;
          clearInterval(this.timerId);
          this.timerId = null;
        } else if (this.itemHasJustEnteredTheContainer === true && this.orderable === true) {
          this.selectedMainItem.currentIndex = this.unmovedElements.length;
          for (let i = 0; i < this.unmovedElements.length; i++) {
            if (selectedItemBoundingClientRect.top < this.unmovedElements[i].getBoundingClientRect().top) {
              this.selectedMainItem.currentIndex = i;
              for (let j = i; j < this.unmovedElements.length; j++) {
                this.translateItem(this.unmovedElements[j], this.selectedMainItem.getBoundingClientRect().height, true);
              }
              break;
            }
          }
          this.isItemContainerScrollingEnabled = true;
          //this.template.querySelector('.placeholder').style.display = 'block';
        } else if (this.isDraggedItemInTheContainer === true && this.orderable === true) {
          let yDiff = event.clientY - this.lastMouseY;
          this.info.yDiff = yDiff;
          clearInterval(this.timerId);
          this.timerId = null;
          let bottomDiff = selectedItemBoundingClientRect.bottom - this.itemContainer.getBoundingClientRect().bottom;
          if (bottomDiff > 0) {
            if (this.timerId == null) {
              this.timerId = setInterval(() => {
                if (this.unmovedElements[this.selectedMainItem.currentIndex] != null) {
                  let itemUnderDraggedItem = this.unmovedElements[this.selectedMainItem.currentIndex];
                  if (itemUnderDraggedItem.getBoundingClientRect().top < selectedItemBoundingClientRect.top) {
                    this.translateItem(itemUnderDraggedItem, 0, true);
                    this.selectedMainItem.currentIndex++;
                  }
                } else {
                  clearInterval(this.timerId);
                  this.timerId = null;
                }
                this.itemContainer.scrollTop = this.itemContainer.scrollTop + 2;
              }, 10);
            }
          }
          let topDiff = selectedItemBoundingClientRect.top - this.itemContainer.getBoundingClientRect().top;
          if (topDiff < 0) {
            if (this.timerId == null) {
              this.timerId = setInterval(() => {
                if (this.unmovedElements[this.selectedMainItem.currentIndex - 1] != null) {
                  let itemAboveDraggedItem = this.unmovedElements[this.selectedMainItem.currentIndex - 1];
                  if (selectedItemBoundingClientRect.top < itemAboveDraggedItem.getBoundingClientRect().top) {
                    this.translateItem(itemAboveDraggedItem, selectedItemBoundingClientRect.height, true);
                    this.selectedMainItem.currentIndex--;
                  }
                } else {
                  clearInterval(this.timerId);
                  this.timerId = null;
                }
                this.itemContainer.scrollTop = this.itemContainer.scrollTop - 2;
              }, 10);
            }
          }


          if (this.unmovedElements[this.selectedMainItem.currentIndex] != null) {
            let itemUnderDraggedItem = this.unmovedElements[this.selectedMainItem.currentIndex];
            if (itemUnderDraggedItem.getBoundingClientRect().top < selectedItemBoundingClientRect.top) {
              this.translateItem(itemUnderDraggedItem, 0, true);
              this.selectedMainItem.currentIndex++;
            }
          }
          if (this.unmovedElements[this.selectedMainItem.currentIndex - 1] != null) {
            let itemAboveDraggedItem = this.unmovedElements[this.selectedMainItem.currentIndex - 1];
            if (selectedItemBoundingClientRect.top < itemAboveDraggedItem.getBoundingClientRect().top) {
              this.translateItem(itemAboveDraggedItem, selectedItemBoundingClientRect.height, true);
              this.selectedMainItem.currentIndex--;
            }
          }
        }
        this.checkIfDraggedItemIsInTheBinBox();
        this.info.currentIndex = this.selectedMainItem.currentIndex;
        this.info.mainItemX = this.selectedMainItem.getBoundingClientRect().left;
        this.info.mainItemY = this.selectedMainItem.getBoundingClientRect().top;
        this.info = {...this.info};
      }
      if (event.touches) {
        this.lastMouseY = event.touches[0].clientY;
        this.lastMouseX = event.touches[0].clientX;
      } else {
        this.lastMouseY = event.clientY;
        this.lastMouseX = event.clientX;
      }

    } catch
      (error) {
      console.error(error);
    }
  };

  handleDragEnd = event => {
    try {
      if (event.button != null && event.button !== 0) {
        return;
      }
      //console.log('dragend');
      removeEventListener("mousemove", this.handleFirstDrag);
      removeEventListener("mousemove", this.handleDrag);
      removeEventListener("mouseup", this.handleDragEnd);
      removeEventListener("touchmove", this.handleFirstDrag);
      removeEventListener("touchmove", this.handleDrag);
      removeEventListener("touchend", this.handleDragEnd);
      clearInterval(this.timerId);
      this.timerId = null;
      if (this.selectedMainItem != null && this.hasDragStarted === true) {
        this.isItemDragEnabled = false;
        this.isDraggedItemInTheContainer = this.isElementInTheOther(this.itemContainer, this.selectedMainItem);
        let containerBoundingClientRect = this.itemContainer.getBoundingClientRect();
        if (this.isDraggedItemInTheContainer === true) {
          let newIndex = this.selectedMainItem.currentIndex;
          let selectedItemIndex = this.selectedItems.indexOf(this.selectedMainItem);
          let positionTop = containerBoundingClientRect.top - this.itemContainer.scrollTop;
          let positionLeft = containerBoundingClientRect.left;
          let itemsInNewOrder = [];
          for (let i = 0; i < Math.min(newIndex, this.unmovedElements.length); i++) {
            itemsInNewOrder.push(this.unmovedElements[i]);
            positionTop += this.unmovedElements[i].getBoundingClientRect().height;
          }
          for (let i = 0; i < selectedItemIndex; i++) {
            itemsInNewOrder.push(this.selectedItems[i]);
          }
          itemsInNewOrder.push(this.selectedMainItem);
          for (let i = selectedItemIndex + 1; i < this.selectedItems.length; i++) {
            itemsInNewOrder.push(this.selectedItems[i]);
          }
          let totalHeight = this.selectedItems[this.selectedItems.length - 1].getBoundingClientRect().bottom - this.selectedItems[0].getBoundingClientRect().top;
          for (let i = newIndex; i < this.unmovedElements.length; i++) {
            itemsInNewOrder.push(this.unmovedElements[i]);
            this.translateItem(this.unmovedElements[i], totalHeight, true)
          }
          let top = positionTop;
          for (let i = 0; i < this.selectedItems.length; i++) {
            this.moveItem(this.selectedItems[i], top, positionLeft, true);
            top += this.selectedItems[i].getBoundingClientRect().height;
          }
          setTimeout(() => {
            let items = [];
            for (const item of itemsInNewOrder) {
              items.push(this._items[+item.dataset.index]);
            }
            //console.log(`items in new order`, items);
            this._items = items;
            this.fireItemsChangeEvent();
            this.cache.push({version: ++this.version, items: [...this._items]});
            this.resetItems();
          }, animationTime);
        } else if (this.checkIfDraggedItemIsInTheBinBox()) {
          this.binBox.classList.remove("visited");
          let unmovedItemIndexes = [];
          let deletedItems = [];
          for (const unmovedElement of this.unmovedElements) {
            unmovedItemIndexes.push(+unmovedElement.dataset.index);
          }
          let items = [];
          for (let i = 0; i < this._items.length; i++) {
            if (unmovedItemIndexes.includes(i)) {
              items.push(this._items[i]);
            } else {
              deletedItems.push(this._items[i]);
            }
          }
          this._items = items;
          this.fireItemsChangeEvent({deletedItems});
          this.cache.push({version: ++this.version, items: [...this._items]});
          this.resetItems();
        } else {
          if (this.group != null) {
            this.publishItemDrop();
          }
          if (this.state != null && this.state.type === "itemReceive") {
            let top = this.state.newPosition.top;
            for (let i = 0; i < this.selectedItems.length; i++) {
              let item = this.selectedItems[i];
              this.moveItem(item, top + i * item.getBoundingClientRect().height, this.state.newPosition.left, true);
            }
            if (this.isShiftButtonPressed === false || this.cloneable === false) {
              setTimeout(() => {
                let items = [];
                for (const unmovedElement of this.unmovedElements) {
                  items.push(this._items[+unmovedElement.dataset.index]);
                }
                this._items = items;
                this.fireItemsChangeEvent();
                this.cache.push({version: ++this.version, items: [...this._items]});
                this.resetItems();
              }, animationTime);
            } else {
              setTimeout(() => {
                this.resetItems();
              }, animationTime);
            }
          } else {
            if (this.orderable === true) {
              for (const item of this.unmovedElements) {
                let yOffset = item.originalTop - item.getBoundingClientRect().top;
                this.translateItem(item, yOffset, true);
              }
            }
            for (const item of this.selectedItems) {
              let top;
              if (item.originalTop > containerBoundingClientRect.top) {
                if (item.originalTop > containerBoundingClientRect.bottom) {
                  top = containerBoundingClientRect.bottom - item.getBoundingClientRect().height;
                } else {
                  top = item.originalTop;
                }
              } else {
                top = containerBoundingClientRect.top;
              }
              this.moveItem(item, top, item.originalLeft, true);
            }
            setTimeout(() => {
              this.resetItems();
              this.itemContainer.scrollTop = this.itemContainer.originalScrollTop;
            }, animationTime);
          }
          this.state = null;
        }
      } else {
        this.resetItems();
      }
      if (this.group != null) {
        setTimeout(() => {
          this.publishFinish();
        }, animationTime);
      }
      this.hasDragStarted = false;
      this.isItemContainerScrollingEnabled = false;
    } catch (error) {
      console.error(error);
    }
  };

  resetItems() {
    if (this.selectedMainItem) {
      this.selectedMainItem.classList.remove("main");
      this.selectedMainItem.style.cursor = "";
    }
    this.selectedMainItem = null;
    this.selectedItems = [];
    this.unmovedElements = [];
    for (const element of this.itemElements) {
      element.style.transform = "";
      element.style.transition = "";
      element.style.position = "";
      element.style.top = "";
      element.style.left = "";
      element.style.width = "";
      element.style.height = "";
      element.classList.remove("selected");
    }
    this.isDraggedItemInTheContainer = false;
    this.isItemDragEnabled = true;
    this.dragDropContainer.style.height = "";
    this.dragDropContainer.style.width = "";
    this.itemContainer.style.height = "";
    this.itemContainer.style.width = "";
    this.itemContainer.classList.remove('active');
    if (this.itemPlaceHolder) {
      this.itemPlaceHolder.style.display = 'none';
      this.itemPlaceHolder.style.height = '';
    }

    //this.publishItemDragIsDisabled(true);
  }

  initItems() {
    try {
      if (this.deletable) {
        this.binBox = this.template.querySelector(".bin-box");
      }
      this.dragDropContainer = this.template.querySelector(".drag-drop-container");
      let boundingClientRect = this.dragDropContainer.getBoundingClientRect();
      //this.dragDropContainer.style.height = boundingClientRect.height + "px";
      //this.dragDropContainer.style.width = boundingClientRect.width + "px";
      this.itemContainer = this.dragDropContainer.querySelector(".item-container");
      //this.itemContainer.style.height = this.itemContainer.getBoundingClientRect().height + "px";
      //this.itemContainer.style.width = this.itemContainer.getBoundingClientRect().width + "px";
      this.itemElements = this.itemContainer.querySelectorAll(".item");
      this.itemPlaceHolder = this.template.querySelector('.item-place-holder');
      for (const item of this.itemElements) {
        let itemBoundingClientRect = item.getBoundingClientRect();
        item.originalTop = itemBoundingClientRect.top;
        item.originalLeft = itemBoundingClientRect.left;
      }
    } catch (error) {
      console.error(error);
    }
  }


  get infos() {
    return JSON.stringify(this.info, null, 2);
  }

  isElementInTheOther(container, item) {
    let containerBoundingClientRect = container.getBoundingClientRect();
    let itemContainerCoordsTop = containerBoundingClientRect.top;
    let itemContainerCoordsRight = containerBoundingClientRect.right;
    let itemContainerCoordsBottom = containerBoundingClientRect.bottom;
    let itemContainerCoordsLeft = containerBoundingClientRect.left;
    let itemBoundingClientRect = item.getBoundingClientRect();
    let topBorderFromTop = itemBoundingClientRect.top;
    let bottomBorderFromTop = itemBoundingClientRect.bottom;
    let leftBorderFromLeft = itemBoundingClientRect.left;
    let rightBorderFromLeft = itemBoundingClientRect.right;
    return itemContainerCoordsTop <= bottomBorderFromTop && topBorderFromTop <= itemContainerCoordsBottom &&
      itemContainerCoordsLeft <= rightBorderFromLeft && leftBorderFromLeft <= itemContainerCoordsRight;
  }

  checkIfDraggedItemIsInTheBinBox() {
    try {
      if (this.deletable === false) {
        return false;
      }
      let isDraggedItemInTheBinBox = this.isElementInTheOther(this.binBox, this.selectedMainItem);
      if (isDraggedItemInTheBinBox) {
        this.binBox.classList.add("visited");
      } else {
        this.binBox.classList.remove("visited");
      }

      this.info.isDraggedItemInTheBinBox = isDraggedItemInTheBinBox;
      this.info = {...this.info};
      return isDraggedItemInTheBinBox;
    } catch (error) {
      console.error(error);
    }
  }

  publishItemDragStart() {
    let boundingClientRect = this.selectedMainItem.getBoundingClientRect();
    let payload = {
      containerId: this.containerId,
      type: "itemDragStart",
      position: {
        top: boundingClientRect.top, right: boundingClientRect.right,
        bottom: boundingClientRect.bottom, left: boundingClientRect.left
      }
    };
    this.storeActions.setState({...this.state, ...payload});
  }

  publishItemDrag() {
    let boundingClientRect = this.selectedMainItem.getBoundingClientRect();
    let payload = {
      containerId: this.containerId,
      type: "itemDrag",
      position: {
        top: boundingClientRect.top, right: boundingClientRect.right,
        bottom: boundingClientRect.bottom, left: boundingClientRect.left
      }
    };
    this.storeActions.setState({...this.state, ...payload});
  }

  publishItemDrop() {
    let totalHeight = this.selectedItems[this.selectedItems.length - 1].getBoundingClientRect().bottom - this.selectedItems[0].getBoundingClientRect().top;
    let boundingClientRect = this.selectedMainItem.getBoundingClientRect();
    let selectedItems = [];
    for (const selectedItem of this.selectedItems) {
      selectedItems.push(this._items[+selectedItem.dataset.index]);
    }
    let payload = {
      containerId: this.containerId,
      type: "itemDrop",
      position: {
        top: boundingClientRect.top, right: boundingClientRect.right,
        bottom: boundingClientRect.bottom, left: boundingClientRect.left
      },
      totalHeight: totalHeight,
      selectedItems: selectedItems
    };
    this.storeActions.setState({...this.state, ...payload});

  }

  publishItemsSuccessfullyReceived(newPosition) {
    let payload = {
      type: "itemReceive",
      selectedItems: this.state.selectedItems,
      sourceContainerId: this.state.containerId,
      containerId: this.containerId,
      newPosition: newPosition
    };
    this.storeActions.setState({...this.state, ...payload});
  }

  publishFinish() {
    let payload = {containerId: this.containerId, type: "finish"};
    this.storeActions.setState({...this.state, ...payload});
  }

  dragDropStateHandler(state) {
    if (state.containerId !== this.containerId) {
      this.state = state;
      ////console.log(`this.containerId, state`, this.containerId, this.state);
      if (state.type === "itemDragStart") {
        this.handleGuestItemDragStart();
      } else if (state.type === "itemDrag") {
        this.handleGuestItemDrag();
      } else if (state.type === "itemDrop") {
        this.handleGuestItemDrop();
      } else if (state.type === "finish") {
        this.state = null;
        this.isGuestItemInTheContainer = false;
        this.isItemContainerScrollingEnabled = false;
        this.isItemDragEnabled = true;
        this.itemContainer.classList.remove('active');
      }
    }
  }

  handleGuestItemDragStart() {
    this.initItems();
    this.itemContainer.classList.add('active');
    this.isItemDragEnabled = false;
    for (const item of this.selectedItems) {
      item.classList.remove("selected");
    }
    this.selectedItems = [];
    this.selectedMainItem = null;
  }

  handleGuestItemDrag() {
    let isGuestItemInTheContainer = this.checkIfGuestItemIsInTheContainer();
    if (this.isGuestItemInTheContainer === true && isGuestItemInTheContainer === false) {
      this.resetItems();
      clearInterval(this.timerId);
      this.timerId = null;
    } else if (this.isGuestItemInTheContainer === false && isGuestItemInTheContainer === true) {
      this.isItemContainerScrollingEnabled = true;
      /*let guestItemHeight = this.state.position.bottom - this.state.position.top;
      if (this._items?.length > 0) {
          this.itemContainer.style.height = (this.itemContainer.getBoundingClientRect().height + guestItemHeight) + "px";
      }*/
    }
    this.isGuestItemInTheContainer = isGuestItemInTheContainer;
    if (this.isGuestItemInTheContainer) {
      //console.log("GUEST ITEM IS IN THE CONTAINER");
      if (this._items?.length > 0) {
        this.itemPlaceHolder.style.display = 'block';
      }
      let guestItemHeight = this.state.position.bottom - this.state.position.top;

      clearInterval(this.timerId);
      this.timerId = null;
      let bottomDiff = this.state.position.bottom - this.itemContainer.getBoundingClientRect().bottom;
      if (bottomDiff > 0) {
        if (this.timerId == null) {
          this.timerId = setInterval(() => {
            for (const item of this.itemElements) {
              if (item.getBoundingClientRect().top < this.state.position.top) {
                this.translateItem(item, 0, true);
              }
            }
            this.itemContainer.scrollTop = this.itemContainer.scrollTop + 2;
          }, 10);
        }
      }
      let topDiff = this.state.position.top - this.itemContainer.getBoundingClientRect().top;
      if (topDiff < 0) {
        if (this.timerId == null) {
          this.timerId = setInterval(() => {
            for (const item of this.itemElements) {
              if (this.state.position.top < item.getBoundingClientRect().top) {
                this.translateItem(item, guestItemHeight, true);
              }
            }
            this.itemContainer.scrollTop = this.itemContainer.scrollTop - 2;
          }, 10);
        }
      }

      for (const item of this.itemElements) {
        if (this.state.position.top < item.getBoundingClientRect().top) {
          this.translateItem(item, guestItemHeight, true);
        } else {
          this.translateItem(item, 0, true);
        }
      }
    }
  }

  handleGuestItemDrop() {
    this.isGuestItemInTheContainer = this.checkIfGuestItemIsInTheContainer();
    if (this.isGuestItemInTheContainer === true) {
      clearInterval(this.timerId);
      this.timerId = null;
      let placeholder = this.template.querySelector('.placeholder');
      if (placeholder) {
        placeholder.style.display = 'none';
      }
      let guestItemHeight = this.state.position.bottom - this.state.position.top;
      this.itemPlaceHolder.style.display = 'block';
      this.itemPlaceHolder.style.height = this.state.totalHeight + 'px';
      /*this.itemContainer.style.height = "";
      if (this._items?.length > 0) {
          this.itemContainer.style.height = (this.itemContainer.getBoundingClientRect().height + this.state.totalHeight) + "px";
      }*/
      //console.log("GUEST ITEM DROPPED IN THE CONTAINER");
      let top = null;
      let left = null;
      let index = null;
      if (this.itemElements.length === 0) {
        top = this.itemContainer.getBoundingClientRect().top;
        left = this.itemContainer.getBoundingClientRect().left;
      } else {
        for (let i = 0; i < this.itemElements.length; i++) {
          let item = this.itemElements[i];
          if (this.state.position.top < item.getBoundingClientRect().top) {
            if (index == null) {
              index = i;
              if (index === 0) {
                top = this.itemContainer.getBoundingClientRect().top;
                left = this.itemContainer.getBoundingClientRect().left;
              } else {
                top = this.itemElements[i - 1].getBoundingClientRect().top + guestItemHeight;
                left = this.itemElements[i - 1].getBoundingClientRect().left;
              }
            }
            this.translateItem(item, this.state.totalHeight, true);
          } else {
            this.translateItem(item, 0, false);
          }
        }
        if (index == null) {
          index = this.itemElements.length;
        }
        if (top == null) {
          top = this.itemElements[this.itemElements.length - 1].getBoundingClientRect().bottom + 1;
          left = this.itemElements[this.itemElements.length - 1].getBoundingClientRect().left;
        }
      }
      this.publishItemsSuccessfullyReceived({top: top, left: left});
      let selectedItems = this.state.selectedItems;
      setTimeout(() => {
        for (let i = selectedItems.length - 1; i >= 0; i--) {
          let guestItem = {...selectedItems[i]};
          this.setFields(guestItem);
          this._items.splice(index, 0, guestItem);
        }
        this.fireItemsChangeEvent({newItems: selectedItems});
        this.cache.push({version: ++this.version, items: [...this._items]});
        this.resetItems();
      }, animationTime);
    } else {
      this.resetItems();
    }
  }

  checkIfGuestItemIsInTheContainer() {
    let containerBoundingClientRect = this.itemContainer.getBoundingClientRect();
    let itemContainerCoordsTop = containerBoundingClientRect.top;
    let itemContainerCoordsRight = containerBoundingClientRect.right;
    let itemContainerCoordsBottom = containerBoundingClientRect.bottom;
    let itemContainerCoordsLeft = containerBoundingClientRect.left;
    return itemContainerCoordsTop <= this.state.position.bottom && this.state.position.top <= itemContainerCoordsBottom &&
      itemContainerCoordsLeft <= this.state.position.right && this.state.position.left <= itemContainerCoordsRight;
  }

  fireItemsChangeEvent(additionalData) {
    let items = this._items.map(item => {
      let clone = {...item};
      delete clone._dragDropItemId;
      delete clone._dragDropName;
      delete clone._dragAndDropStyleClass;
      return clone;
    });
    let changeEvent = new CustomEvent("change", {detail: {items, ...additionalData}, bubbles: true, composed: true});
    //console.log(`changeEvent.detail`, JSON.parse(JSON.stringify(changeEvent.detail)));
    this.dispatchEvent(changeEvent);
  }

  translateItem(item, px, withAnimation) {
    item.style.transition = "";
    if (withAnimation === true) {
      item.style.transition = `transform ${animationTime}ms`;
    }
    item.style.transform = "translate(0px, " + px + "px)";
  }

  moveItem(item, top, left, withAnimation) {
    item.style.position = "fixed";
    item.style.transform = "";
    item.style.transition = "";
    if (withAnimation) {
      item.style.transition = `left ${animationTime}ms, top ${animationTime}ms`;
    }
    item.style.top = top + "px";
    item.style.left = left + "px";
  }

  handleUndoClick() {
    this.cache.pop();
    if (this.cache.length > 0) {
      this._items = this.cache[this.cache.length - 1].items;
    } else if (this.originalItems) {
      this._items = [...this.originalItems];
    } else {
      this._items = [];
    }
    //console.log(`this.cache`, JSON.parse(JSON.stringify(this.cache)));

    if (this.group != null) {
      this.storeActions.setState({containerId: this.containerId, type: 'undo', version: this.version});
    }
    this.fireItemsChangeEvent();
  }
}
