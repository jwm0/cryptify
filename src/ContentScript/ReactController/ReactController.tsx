import React from "react";
import ReactDOM from "react-dom";

import { Input, InputProps } from "../Input";
import { Select, SelectProps } from "../Select";

type Props = {
  type: null | "Input" | "Select";
  options: {} | InputProps | SelectProps;
  handleClose(): void;
};

export class ReactController {
  node: Element;

  type: Props["type"];

  options: Props["options"];

  constructor() {
    // Create and prepare shadow node for React injection
    const shadowHost = document.createElement("div");
    shadowHost.id = "root-cryptify";
    shadowHost.style.position = "relative";
    shadowHost.style.zIndex = "2147483640";
    document.body.appendChild(shadowHost);
    const shadowRoot = shadowHost.attachShadow({ mode: "open" });
    const reactRoot = document.createElement("div");
    shadowRoot.appendChild(reactRoot);
    Object.defineProperty(reactRoot, "ownerDocument", { value: shadowRoot });
    // @ts-ignore
    shadowRoot.createElement = (...args) => document.createElement(...args);

    this.node = reactRoot;
    this.type = null;
    this.options = {};
    this.render();
  }

  openInput(onSubmit: InputProps["handleSubmit"], type: InputProps["type"]) {
    this.options = {
      handleSubmit: (...args) => {
        onSubmit(...args);
        this.close();
      },
      type,
    };
    this.type = "Input";
    this.render();
  }

  openSelect(
    onSubmit: SelectProps["handleSelect"],
    options: SelectProps["options"]
  ) {
    this.options = {
      handleSelect: (...args) => {
        onSubmit(...args);
        this.close();
      },
      options,
    };
    this.type = "Select";
    this.render();
  }

  close = () => {
    this.type = null;
    this.render();
  };

  unmount() {
    ReactDOM.unmountComponentAtNode(this.node);
  }

  private render() {
    ReactDOM.render(
      <App type={this.type} options={this.options} handleClose={this.close} />,
      this.node
    );
  }
}

const App: React.FC<Props> = ({ handleClose, type, options }) => {
  React.useEffect(() => {
    const handleCloseOnEsc = ({ keyCode }: KeyboardEvent) => {
      if (keyCode === 27) {
        handleClose();
      }
    };

    document.addEventListener("keyup", handleCloseOnEsc);

    return () => {
      document.removeEventListener("keyup", handleCloseOnEsc);
    };
  }, [handleClose]);

  switch (type) {
    case "Input":
      return <Input {...(options as InputProps)} />;
    case "Select":
      return <Select {...(options as SelectProps)} />;
    default:
      return null;
  }
};
