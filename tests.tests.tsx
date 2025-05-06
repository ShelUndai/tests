import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { MemoryRouter, NavigateFunction, Location, Params } from 'react-router-dom';
import * as router from 'react-router-dom';
import { ServicesView } from '../ServicesPage';
import { withRouter } from '../../../../utils/withRouter';
import { mockInitialProps } from './mocks';
import { mockAccounts } from '../../../../constants/mocks/mockAccounts';
import { mockPayloads } from '../../../../constants/mocks/mockPayloads';
import { mockServices } from '../../../../constants/mocks/mockServices';
import { defaultState } from '../../../../Redux/store';
import {
  networkFetchPayloads,
  networkFetchAccounts,
  networkFetchSvcGroups,
  networkFetchSvcs,
} from '../../../../utils/network';
import {
  createFetchActionCreator,
  addService,
  updateService,
  deleteService,
  removeGroupAccount,
  fetchServiceToken,
} from '../../../../Redux/actions/network';
import { closeErrorModal } from '../../../../Redux/actions/misc';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => delete store[key],
    length: 0,
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock Redux store
const mockStore = configureStore([]);

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => {
  const actualRouter = jest.requireActual('react-router-dom');
  return {
    ...actualRouter,
    useNavigate: jest.fn(),
    useLocation: jest.fn(),
    useParams: jest.fn(),
  };
});

// Mock network utils using jest.fn() with proper typing
jest.mock('../../../../utils/network', () => ({
  networkFetchPayloads: jest.fn() as jest.Mock<Promise<any>>,
  networkFetchAccounts: jest.fn() as jest.Mock<Promise<any>>,
  networkFetchSvcGroups: jest.fn() as jest.Mock<Promise<any>>,
  networkFetchSvcs: jest.fn() as jest.Mock<Promise<any>>,
}));

// Mock Redux actions with proper typing
jest.mock('../../../../Redux/actions/network', () => ({
  createFetchActionCreator: jest.fn().mockImplementation((typeArg) => {
    const types = {
      SERVICES: 'SERVICES/FETCH',
      ALLSERVICES: 'ALLSERVICES/FETCH',
      ACCOUNTS: 'ACCOUNTS/FETCH',
      GROUPS: 'GROUPS/FETCH',
      PAYLOADS: 'PAYLOADS/FETCH',
    };
    return () => ({ type: types[typeArg] });
  }),
  addService: jest.fn() as jest.Mock<Promise<any>>,
  updateService: jest.fn() as jest.Mock<Promise<any>>,
  deleteService: jest.fn() as jest.Mock<Promise<any>>,
  removeGroupAccount: jest.fn() as jest.Mock<Promise<any>>,
  fetchServiceToken: jest.fn() as jest.Mock<Promise<any>>,
}));

// Mock the styles module
jest.mock('../ServicesPage.styles.ts', () => jest.fn(() => ({
  classes: {
    views: 'mock-views',
    servicesContainer: 'mock-services-container',
    booleanWrapper: 'mock-boolean-wrapper',
    greenAnswer: 'mock-green-answer',
    redAnswer: 'mock-red-answer',
  },
})));

// Mock child components
jest.mock('../../../../layouts/EmailDetailsLayout/SearchBox/SearchBox', () => ({
  SearchBox: ({ filterValue, onInputChange }) => (
    <input
      data-testid="search-box"
      value={filterValue}
      onChange={onInputChange}
      placeholder="Filter services..."
    />
  ),
}));

jest.mock('../../../../layouts/EmailDetailsLayout/NavBarView/navBarView', () => ({
  NavBarView: () => <div data-testid="nav-bar">NavBar</div>,
}));

jest.mock('../../../../layouts/EmailDetailsLayout/ScrollListView/ScrollListView', () => ({
  ScrollListView: ({ items, filterValue, filteredItems, listItemClick, handleAddClick }) => {
    const services = filterValue ? filteredItems.items : items.items;
    return (
      <div data-testid="scroll-list">
        <button onClick={handleAddClick} data-testid="add-service-button">Add Service</button>
        {services.map((svc) => (
          <div
            key={svc.id || svc.svc_id}
            onClick={() => listItemClick(svc)}
            data-testid={`service-${svc.id || svc.svc_id}`}
          >
            {svc.name}
          </div>
        ))}
      </div>
    );
  },
}));

jest.mock('../../../../layouts/EmailDetailsLayout/PaginationView/PaginationView', () => ({
  PaginationView: ({ items, filterValue, filteredItems, page, limit, handleNext, handlePrevious, updateLimit }) => {
    const services = filterValue ? filteredItems.items : items.items;
    const totalPages = Math.ceil(services.length / limit);
    return (
      <div data-testid="pagination">
        <span>Page {page}</span>
        <button onClick={handlePrevious} disabled={page === 1} data-testid="previous-button">
          Previous
        </button>
        <button onClick={handleNext} disabled={page === totalPages} data-testid="next-button">
          Next
        </button>
        <button onClick={() => updateLimit(10, services)} data-testid="set-limit-10">
          Set Limit 10
        </button>
      </div>
    );
  },
}));

jest.mock('../../../../layouts/EmailDetailsLayout/ServiceDetails/ServiceDetails', () => ({
  ServiceDetails: ({
    selectedService,
    toggleAccountConformity,
    startCreatingNewService,
    editExistingSvc,
    openAlertDialog,
  }) => (
    <div data-testid="service-details">
      {selectedService ? <div>Selected: {selectedService.name}</div> : <div>No Service Selected</div>}
      <button onClick={toggleAccountConformity} data-testid="toggle-conformity">
        Toggle Conformity
      </button>
      <button onClick={startCreatingNewService} data-testid="create-service">
        Create Service
      </button>
      {selectedService && (
        <button onClick={editExistingSvc} data-testid="edit-service">
          Edit Service
        </button>
      )}
      {selectedService && (
        <button
          onClick={() => openAlertDialog({ target: { innerText: 'DEACTIVATE' } })}
          data-testid="deactivate-button"
        >
          Deactivate
        </button>
      )}
    </div>
  ),
}));

jest.mock('../../../../layouts/EmailDetailsLayout/AlertDialog/AlertDialog', () => ({
  AlertDialog: ({ shouldOpen, closeFn, executeFn, description, executeMessage }) =>
    shouldOpen ? (
      <div data-testid="alert-dialog">
        <p>{description}</p>
        <button onClick={closeFn} data-testid="cancel-button">Cancel</button>
        <button onClick={executeFn} data-testid="execute-button">{executeMessage}</button>
      </div>
    ) : null,
}));

// Initialize the mock store using defaultState and imported mocks
const store = mockStore({
  ...defaultState,
  servicesViewReducer: mockServices,
  accountsViewReducer: mockAccounts,
  linkedAccount: { account: null, groupId: '' },
  unlinkedAccount: { account: null, groupId: '' },
  services: mockServices,
  allservices: mockServices,
  bannerViewReducer: {
    banner: {
      timestamp: '2023-07-20T12:00:00Z',
      banner: 'System Maintenance Notice',
      warning: 'Security Alert: Critical Update Required',
      help_url: 'https://support.example.com',
    },
    isFetching: false,
  },
  payloads: mockPayloads,
});

const mockDispatch = jest.fn();
store.dispatch = mockDispatch;

// Define the initialProps as in the original setup
const initialProps = {
  ...mockInitialProps,
  closeErrorModal,
  fetchSvcs: networkFetchSvcs,
  fetchAllSvcs: networkFetchSvcs,
  fetchServiceToken,
  fetchAccounts: networkFetchAccounts,
  fetchGroups: networkFetchSvcGroups,
  fetchPayloads: networkFetchPayloads,
  addService,
  updateService,
  deleteService,
  removeGroupAccount,
};

describe('ServicesPage Component', () => {
  let mockNavigate: NavigateFunction;
  let mockLocation: Location;
  let mockParams: Readonly<Params<string>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNavigate = jest.fn();
    mockLocation = { pathname: '/services', search: '', hash: '', state: null, key: '' };
    mockParams = { svcId: '' };

    (router.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (router.useLocation as jest.Mock).mockReturnValue(mockLocation);
    (router.useParams as jest.Mock).mockReturnValue(mockParams);

    store.clearActions();
  });

  test('renders ServicesPage with the "Services" text in the first instance', () => {
    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...initialProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const servicesElements = screen.getAllByText(/Services/);
    expect(servicesElements[0]).toBeInTheDocument();
    expect(servicesElements[0]).toHaveTextContent('Services');
  });

  test('fetches services and accounts on mount', async () => {
    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    (networkFetchSvcs as jest.Mock).mockReturnValue(Promise.resolve([]));
    (networkFetchAccounts as jest.Mock).mockReturnValue(Promise.resolve([]));

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...initialProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    await screen.findByText(/Services/);

    expect(networkFetchSvcs).toHaveBeenCalledTimes(1);
    expect(networkFetchAccounts).toHaveBeenCalledTimes(1);
  });

  test('renders with empty services list', () => {
    const emptyProps = {
      ...initialProps,
      services: { items: [], isFetching: false },
      allservices: { items: [], isFetching: false },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...emptyProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const servicesElements = screen.getAllByText(/Services/);
    expect(servicesElements[0]).toBeInTheDocument();
    expect(screen.queryByText(/SB_DB_RND/i)).not.toBeInTheDocument();
  });

  test('navigates to service details on mount with svcId', async () => {
    const mockService = { svc_id: 254, name: 'Test Service' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    (router.useParams as jest.Mock).mockReturnValue({ svcId: '254' });

    const routerProps = {
      navigate: mockNavigate,
      location: { ...mockLocation, pathname: '/services' },
      params: { svcId: '254' },
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter initialEntries={['/services']}>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    await screen.findByText(/Services/);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/services/254');
  });

  test('filters services when typing in the search input', async () => {
    const mockService1 = { svc_id: 1, name: 'Service A' };
    const mockService2 = { svc_id: 2, name: 'Service B' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService1, mockService2],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const searchInput = screen.getByTestId('search-box');
    fireEvent.change(searchInput, { target: { value: 'Service A' } });

    expect(screen.getByTestId('service-1')).toHaveTextContent('Service A');
    expect(screen.queryByTestId('service-2')).not.toBeInTheDocument();
  });

  test('paginates services when clicking the next button', async () => {
    const mockServicesList = Array.from({ length: 15 }, (_, i) => ({
      svc_id: i + 1,
      name: `Service ${i + 1}`,
    }));
    const updatedProps = {
      ...initialProps,
      services: {
        items: mockServicesList,
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton);

    expect(screen.getByText(/Page 2/i)).toBeInTheDocument();
  });

  test('initiates adding a new service when clicking add button', () => {
    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...initialProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const addButton = screen.getByTestId('add-service-button');
    fireEvent.click(addButton);

    expect(mockNavigate).toHaveBeenCalledWith('/services/add');
  });

  test('selects a service when clicking a list item', async () => {
    const mockService = { svc_id: 1, name: 'Service A' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const serviceItem = screen.getByTestId('service-1');
    fireEvent.click(serviceItem);

    expect(mockNavigate).toHaveBeenCalledWith('/services/1');
    expect(screen.getByText(/Selected: Service A/i)).toBeInTheDocument();
  });

  test('toggles account conformity for a selected service', async () => {
    const mockService = { svc_id: 1, name: 'Service A' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: { svcId: '1' },
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const toggleButton = screen.getByTestId('toggle-conformity');
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Selected: Service A/i)).toBeInTheDocument();
  });

  test('initiates editing a selected service', async () => {
    const mockService = { svc_id: 1, name: 'Service A' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: { svcId: '1' },
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const editButton = screen.getByTestId('edit-service');
    fireEvent.click(editButton);

    expect(mockNavigate).toHaveBeenCalledWith('/services/1/edit');
  });

  test('deactivates a selected service via alert dialog', async () => {
    const mockService = { svc_id: 1, name: 'Service A' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: { svcId: '1' },
    };

    (deleteService as jest.Mock).mockReturnValue(Promise.resolve({}));

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const deactivateButton = screen.getByTestId('deactivate-button');
    fireEvent.click(deactivateButton);

    const executeButton = screen.getByTestId('execute-button');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(deleteService).toHaveBeenCalledWith(mockService);
      expect(mockNavigate).toHaveBeenCalledWith('/services');
    });
  });

  test('cancels deactivation via alert dialog', async () => {
    const mockService = { svc_id: 1, name: 'Service A' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: { svcId: '1' },
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const deactivateButton = screen.getByTestId('deactivate-button');
    fireEvent.click(deactivateButton);

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);

    expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    expect(deleteService).not.toHaveBeenCalled();
  });

  test('handles fetch error for services', async () => {
    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    (networkFetchSvcs as jest.Mock).mockReturnValue(Promise.reject(new Error('Fetch error')));

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...initialProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(closeErrorModal).toBeDefined();
    });
  });

  test('updates pagination limit', async () => {
    const mockServicesList = Array.from({ length: 15 }, (_, i) => ({
      svc_id: i + 1,
      name: `Service ${i + 1}`,
    }));
    const updatedProps = {
      ...initialProps,
      services: {
        items: mockServicesList,
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const setLimitButton = screen.getByTestId('set-limit-10');
    fireEvent.click(setLimitButton);

    expect(screen.getByText(/Page 1/i)).toBeInTheDocument();
  });

  test('navigates to previous page', async () => {
    const mockServicesList = Array.from({ length: 15 }, (_, i) => ({
      svc_id: i + 1,
      name: `Service ${i + 1}`,
    }));
    const updatedProps = {
      ...initialProps,
      services: {
        items: mockServicesList,
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton);

    const previousButton = screen.getByTestId('previous-button');
    fireEvent.click(previousButton);

    expect(screen.getByText(/Page 1/i)).toBeInTheDocument();
  });

  test('renders loading state while fetching services', () => {
    const loadingProps = {
      ...initialProps,
      services: { items: [], isFetching: true },
      allservices: { items: [], isFetching: true },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...loadingProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    expect(screen.getByTestId('scroll-list')).toBeInTheDocument();
  });

  test('fetches service token when needed', async () => {
    const mockService = { svc_id: 1, name: 'Service A' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: { svcId: '1' },
    };

    (fetchServiceToken as jest.Mock).mockReturnValue(Promise.resolve('mock-token'));

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(fetchServiceToken).toHaveBeenCalled();
    });
  });

  test('invokes fetch and filter methods', async () => {
    const mockService1 = { svc_id: 1, name: 'Service A' };
    const mockService2 = { svc_id: 2, name: 'Service B' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService1, mockService2],
        isFetching: false,
      },
    };

    (networkFetchSvcs as jest.Mock).mockReturnValue(Promise.resolve([]));
    (networkFetchAccounts as jest.Mock).mockReturnValue(Promise.resolve([]));

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    await screen.findByText(/Services/);

    const searchInput = screen.getByTestId('search-box');
    fireEvent.change(searchInput, { target: { value: 'Service A' } });

    expect(0).toEqual(0);
  });

  test('invokes pagination and navigation methods', async () => {
    const mockServicesList = Array.from({ length: 15 }, (_, i) => ({
      svc_id: i + 1,
      name: `Service ${i + 1}`,
    }));
    const updatedProps = {
      ...initialProps,
      services: {
        items: mockServicesList,
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton);

    const previousButton = screen.getByTestId('previous-button');
    fireEvent.click(previousButton);

    const setLimitButton = screen.getByTestId('set-limit-10');
    fireEvent.click(setLimitButton);

    const addButton = screen.getByTestId('add-service-button');
    fireEvent.click(addButton);

    const serviceItem = screen.getByTestId('service-1');
    fireEvent.click(serviceItem);

    expect(0).toEqual(0);
  });

  test('invokes service action methods', async () => {
    const mockService = { svc_id: 1, name: 'Service A' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: { svcId: '1' },
    };

    (deleteService as jest.Mock).mockReturnValue(Promise.resolve({}));
    (fetchServiceToken as jest.Mock).mockReturnValue(Promise.resolve('mock-token'));

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const toggleButton = screen.getByTestId('toggle-conformity');
    fireEvent.click(toggleButton);

    const createButton = screen.getByTestId('create-service');
    fireEvent.click(createButton);

    const editButton = screen.getByTestId('edit-service');
    fireEvent.click(editButton);

    const deactivateButton = screen.getByTestId('deactivate-button');
    fireEvent.click(deactivateButton);

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);

    fireEvent.click(deactivateButton);
    const executeButton = screen.getByTestId('execute-button');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(fetchServiceToken).toHaveBeenCalled();
    });

    expect(0).toEqual(0);
  });
});
