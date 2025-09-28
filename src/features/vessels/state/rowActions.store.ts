import { create } from 'zustand';

type Handlers = {
  viewInvoices: (rowId: string|number)=>void;
  newInvoice:   (rowId: string|number)=>void;
  edit:         (rowId: string|number)=>void;
  del:          (rowId: string|number)=>void;
};

type Pos = { top:number; left:number };

type RowActionsState = {
  open: boolean;
  rowId: string|number|null;
  pos: Pos|null;
  handlers: Handlers|null;
  openAt: (args:{rowId:string|number; pos:Pos; handlers:Handlers})=>void;
  close: ()=>void;
};

export const useRowActionsStore = create<RowActionsState>((set)=>({
  open: false,
  rowId: null,
  pos: null,
  handlers: null,
  openAt: ({rowId,pos,handlers}) => set({ open:true, rowId, pos, handlers }),
  close: () => set({ open:false, rowId:null, pos:null, handlers:null }),
}));