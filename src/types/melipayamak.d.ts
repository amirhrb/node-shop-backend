declare module "melipayamak" {
  interface SMS {
    send(to: string, from: string, text: string): Promise<any>;
  }

  class Melipayamak {
    constructor(username: string, password: string);
    sms(): SMS;
  }

  export default Melipayamak;
}
